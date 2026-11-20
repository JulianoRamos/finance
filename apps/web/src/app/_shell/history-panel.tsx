'use client';

import { History, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useRef, useState } from 'react';

import { ErrorNotice } from '../_access/fields';
import { GHOST_BUTTON, GHOST_ICON_BUTTON, SECONDARY_BUTTON } from './buttons';
import { Hint } from './hint';
import type { ListPageResult } from './list-page';
import { Pagination, useLatestRequest } from './pagination';

// O histórico de alterações como o painel o mostra (LLD, seção 4.4): cada alteração numa frase, com os
// campos nos rótulos e nos formatos da tela, que o módulo do registro escreve.

/** Um campo que mudou, já formatado: o valor vazio é nulo, e a tela o diz "vazio". */
export interface HistoryLine {
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
}

/** Uma alteração como o painel a mostra. */
export interface HistoryItem {
  readonly id: string;
  /** A frase: quem fez e o quê, como "Ana Lima alterou". */
  readonly sentence: string;
  /** Quando, como `dd/mm/aaaa hh:mm`. */
  readonly occurredAt: string;
  readonly lines: readonly HistoryLine[];
}

/** A busca de uma página do histórico, uma ação do servidor que já devolve cada alteração dita. */
export type LoadHistoryPage = (page: number) => Promise<ListPageResult<HistoryItem>>;

/** O que o painel mostra: a página lida, a falha, ou nulo enquanto carrega. */
type Shown = ListPageResult<HistoryItem> | null;

/**
 * O "Histórico" do cabeçalho do detalhe de um registro, como uma entidade ou uma conta, e o painel lateral
 * que ele abre (design-system.md, seção 4.5): as alterações, de 10 em 10, pedidas à api a cada abertura e a
 * cada página, sem mudar o endereço. Fecha com Esc e com o botão de fechar, e devolve o foco ao
 * "Histórico". `description` diz de quem é o histórico ("Ana Lima · entidade").
 */
export function HistoryPanel({ description, loadPage }: Readonly<{ description: string; loadPage: LoadHistoryPage }>) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Shown>(null);
  // A página pedida por último, que o "Tentar de novo" pede de novo.
  const [requested, setRequested] = useState(1);
  const { request, cancel } = useLatestRequest();
  const content = useRef<HTMLDivElement>(null);

  async function load(page: number) {
    setRequested(page);
    const result = await request(() => loadPage(page));
    if (result) setShown(result);
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setShown(null);
      void load(1);
    } else {
      // Um pedido em curso quando o painel fecha não vale mais.
      cancel();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className={`${GHOST_BUTTON} flex-none`}>
        <History size={16} strokeWidth={1.5} aria-hidden="true" />
        Histórico
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          ref={content}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-panel flex-col gap-6 overflow-y-auto border-l border-hairline bg-surface p-6 shadow-flutuante focus:outline-none"
          onOpenAutoFocus={(event) => {
            // O foco vai para o painel, e não para o botão de fechar, que abriria a dica dele.
            event.preventDefault();
            content.current?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-heading-md text-ink">Histórico de alterações</Dialog.Title>
              <Dialog.Description className="wrap-anywhere">{description}</Dialog.Description>
            </div>
            <Hint label="Fechar o histórico" expanded={false} side="bottom">
              <Dialog.Close aria-label="Fechar o histórico" className={`${GHOST_ICON_BUTTON} inline-flex size-8`}>
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </Dialog.Close>
            </Hint>
          </div>
          <HistoryBody
            shown={shown}
            onPage={(page) => {
              void load(page);
            }}
            onRetry={() => {
              void load(requested);
            }}
          />
          <p className="text-body-sm text-mute">
            O histórico vem da auditoria e não pode ser alterado. Da mais recente para a mais antiga.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** As alterações da página, os blocos do carregamento ou o aviso da falha, com "Tentar de novo". */
function HistoryBody({
  shown,
  onPage,
  onRetry,
}: Readonly<{ shown: Shown; onPage: (page: number) => void; onRetry: () => void }>) {
  if (!shown) {
    return (
      <div aria-busy="true" aria-label="Carregando o histórico" className="flex flex-col gap-3">
        {[0, 1, 2].map((block) => (
          <div key={block} className="h-10 rounded-sm bg-surface-subtle" />
        ))}
      </div>
    );
  }
  if (!shown.ok) {
    return (
      <ErrorNotice>
        <span className="flex flex-wrap items-center gap-3">
          Não foi possível carregar o histórico.
          <button type="button" className={SECONDARY_BUTTON} onClick={onRetry}>
            Tentar de novo
          </button>
        </span>
      </ErrorNotice>
    );
  }
  const { page } = shown;
  if (page.total === 0) return <p>Nenhuma alteração registrada.</p>;
  return (
    <div className="flex flex-col">
      <ol className="flex flex-col">
        {page.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 border-hairline py-3 not-first:border-t">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium wrap-anywhere text-ink">{item.sentence}</span>
              <span className="text-mute tabular-nums">{item.occurredAt}</span>
            </div>
            {item.lines.map((line) => (
              <ChangeLine key={line.label} line={line} />
            ))}
          </li>
        ))}
      </ol>
      {page.total > page.pageSize && (
        <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onPage={onPage} />
      )}
    </div>
  );
}

/** Um campo que mudou: o rótulo, o antes riscado e o depois em destaque; o vazio é dito "vazio". */
function ChangeLine({ line }: Readonly<{ line: HistoryLine }>) {
  return (
    <span className="text-body-sm wrap-anywhere tabular-nums">
      {`${line.label}: `}
      {line.before === null ? <span className="text-mute">vazio</span> : <del>{line.before}</del>}
      {' → '}
      {line.after === null ? (
        <span className="text-mute">vazio</span>
      ) : (
        <ins className="font-medium text-ink no-underline">{line.after}</ins>
      )}
    </span>
  );
}
