'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { SECONDARY_ICON_BUTTON } from './buttons';
import { Hint } from './hint';
import type { ListPage, ListPageResult } from './list-page';

// A busca e a página das listas (design-system.md, seções 4.1, 4.3 e 4.4): cada busca e cada troca de
// página é um pedido à api, e a tela nunca filtra nem pagina o que já leu (LLD, seção 5).

/** Quanto a busca espera depois da última tecla para pedir a lista. */
const SEARCH_DELAY_MS = 300;

/** O pedido de uma página: a busca e o número da página. */
export type LoadPage<Item> = (query: { q: string; page: number }) => Promise<ListPageResult<Item>>;

/**
 * A busca e a página de uma lista, que começa na página dada. A busca espera 300 ms depois da última
 * tecla e volta à primeira página; só a resposta do último pedido vale. Quando a página inicial muda,
 * como depois de salvar, a lista volta a ela, sem busca.
 */
export function useSearchedPages<Item>(initial: ListPage<Item>, load: LoadPage<Item>) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(initial);
  // A busca da página mostrada, que a troca de página repete: a do campo pode ainda não ter sido pedida.
  const [shownQuery, setShownQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const [previousInitial, setPreviousInitial] = useState(initial);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (initial !== previousInitial) {
    setPreviousInitial(initial);
    setQuery('');
    setShown(initial);
    setShownQuery('');
    setFailed(false);
  }

  // Um pedido em curso quando a página inicial muda, ou quando a lista sai da tela, não vale mais.
  useEffect(
    () => () => {
      latest.current += 1;
      clearTimeout(timer.current);
    },
    [initial],
  );

  async function request(q: string, page: number) {
    latest.current += 1;
    const id = latest.current;
    let result: ListPageResult<Item>;
    try {
      result = await load({ q, page });
    } catch {
      // A ação do servidor não respondeu, como sem rede: a lista avisa, como na falha da api.
      result = { ok: false };
    }
    if (id !== latest.current) return;
    setFailed(!result.ok);
    if (result.ok) {
      setShown(result.page);
      setShownQuery(q);
    }
  }

  return {
    query,
    shown,
    failed,
    search: (text: string) => {
      setQuery(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void request(text, 1), SEARCH_DELAY_MS);
    },
    // A busca que ainda espera a última tecla continua agendada, e a resposta dela vale por último.
    goTo: (page: number) => {
      void request(shownQuery, page);
    },
  };
}

const COUNT = new Intl.NumberFormat('pt-BR');

/**
 * A Paginação, no rodapé da lista (design-system.md, seção 4.4): o intervalo e o total à esquerda, e
 * os botões da página anterior e da próxima à direita, desabilitados nas pontas.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: Readonly<{ page: number; pageSize: number; total: number; onPage: (page: number) => void }>) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  // A página depois da última, quando a lista encolheu entre dois pedidos, vem vazia, e o total continua valendo.
  let range = `${COUNT.format(first)}–${COUNT.format(last)} de ${COUNT.format(total)}`;
  if (total === 0) range = 'Nenhum resultado';
  else if (first > total) range = `Nenhum item nesta página, de ${COUNT.format(total)}`;
  return (
    <nav aria-label="Paginação" className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-3">
      <span className="text-body-sm text-mute" aria-live="polite">
        {range}
      </span>
      <span className="flex gap-1">
        <PageButton
          label="Página anterior"
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        </PageButton>
        <PageButton
          label="Próxima página"
          disabled={last >= total}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </PageButton>
      </span>
    </nav>
  );
}

/** Um botão de ícone da Paginação, com a dica. */
function PageButton({
  label,
  disabled,
  onClick,
  children,
}: Readonly<{ label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }>) {
  const button = (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={SECONDARY_ICON_BUTTON}>
      {children}
    </button>
  );
  // O botão desabilitado não recebe o ponteiro, e a dica dele não abriria.
  return disabled ? (
    button
  ) : (
    <Hint label={label} expanded={false} side="bottom">
      {button}
    </Hint>
  );
}
