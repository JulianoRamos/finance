'use client';

import { ChevronLeft, Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../_shell/buttons';

const PANEL = 'flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4';

/**
 * O corpo da tela Contas (design-system.md, seção 4.1): a Coluna e o Conteúdo lado a lado a partir do
 * desktop, um embaixo do outro no tablet e, no celular, um dos dois: a lista, na página da lista, ou o
 * item, na subpágina dele, com o link de volta à lista. Na página da lista, sem nenhuma conta no contexto, o
 * estado vazio ocupa a tela, e a falha da lista, o erro de carregamento. Numa subpágina, o item não depende
 * da lista, como a conta de outro contexto aberta pela pesquisa: a falha fica na Coluna, e o item aparece.
 */
export function AccountColumns({
  list,
  status,
  children,
}: Readonly<{ list: ReactNode; status: 'ok' | 'empty' | 'error'; children: ReactNode }>) {
  // O segmento abaixo do layout: nulo na página da lista, `new` na criação, e o id da conta no item.
  const segment = useSelectedLayoutSegment();
  if (segment === null && status === 'empty') return <EmptyAccounts />;
  if (segment === null && status === 'error') {
    return (
      <section aria-label="Lista de contas" className="rounded-md border border-hairline bg-surface p-6 lg:col-span-3">
        <ListLoadError />
      </section>
    );
  }
  const inItem = segment !== null;
  return (
    <>
      <section aria-label="Lista de contas" className={`${PANEL} ${inItem ? 'max-md:hidden' : ''}`}>
        {status === 'error' ? <ListLoadError /> : list}
      </section>
      <div className={`flex min-w-0 flex-col gap-4 lg:col-span-2 ${inItem ? '' : 'max-md:hidden'}`}>
        {inItem && (
          <Link
            href="/accounts"
            className={`inline-flex items-center gap-1 self-start rounded-sm text-label text-link md:hidden ${FOCUS_RING}`}
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Contas
          </Link>
        )}
        {children}
      </div>
    </>
  );
}

/** O estado vazio, sem nenhuma conta no contexto: o que falta e a ação que resolve (design-system.md, 4.5). */
function EmptyAccounts() {
  return (
    <section
      aria-labelledby="empty-title"
      className="flex flex-col items-center gap-2 rounded-md border border-hairline bg-surface px-6 py-12 text-center lg:col-span-3"
    >
      <Wallet size={20} strokeWidth={1.5} aria-hidden="true" className="mb-1 text-mute" />
      <h2 id="empty-title" className="text-heading-sm text-ink">
        Nenhuma conta ainda.
      </h2>
      <p className="max-w-section">
        Cadastre as contas de cada entidade, com o saldo inicial, para que o saldo seja calculado a partir daí.
      </p>
      <Link href="/accounts/new" className={PRIMARY_BUTTON}>
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        Cadastrar conta
      </Link>
    </section>
  );
}

/** O erro de carregamento da lista, com "Tentar de novo" (design-system.md, seção 4.5). */
function ListLoadError() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNotice>Não foi possível carregar as contas.</ErrorNotice>
      <button
        type="button"
        className={SECONDARY_BUTTON}
        onClick={() => {
          router.refresh();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}
