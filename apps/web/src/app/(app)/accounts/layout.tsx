import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';

import { type AccountList as AccountListResult, listAccounts } from '@/api/accounts';

import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { mapPage } from '../../_shell/list-page';
import { AccountColumns } from './account-columns';
import { AccountList } from './account-list';
import { accountListItem } from './account-list-page';

export const metadata: Metadata = { title: 'Contas · finance' };

/** O que a Coluna mostra: a lista, o estado vazio do contexto sem contas, ou a falha da lista. */
function listStatus(list: AccountListResult): 'ok' | 'empty' | 'error' {
  if (list.status !== 'ok') return 'error';
  return list.data.total === 0 ? 'empty' : 'ok';
}

/** A Coluna e o Conteúdo depois de a lista das contas do contexto chegar. */
async function AccountsBody({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const list = await listAccounts();
  if (list.status === 'unauthenticated') redirect('/login');
  return (
    <AccountColumns
      status={listStatus(list)}
      list={list.status === 'ok' && <AccountList initial={mapPage(list.data, accountListItem)} />}
    >
      {children}
    </AccountColumns>
  );
}

/**
 * A Coluna e o Conteúdo enquanto a lista carrega: blocos cinza no formato deles, e não um indicador girando
 * (design-system.md, seção 4.5).
 */
function AccountsSkeleton() {
  return (
    <>
      <section
        aria-label="Lista de contas"
        aria-busy="true"
        className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4"
      >
        <div className="h-9 rounded-sm bg-surface-subtle" />
        {[0, 1, 2, 3].map((block) => (
          <div key={block} className="h-12 rounded-sm bg-surface-subtle" />
        ))}
      </section>
      <div className="flex min-w-0 flex-col gap-6 rounded-md border border-hairline bg-surface p-4 max-md:hidden md:p-6 lg:col-span-2">
        <div className="h-7 w-1/3 rounded-sm bg-surface-subtle" />
        <div className="h-5 w-1/2 rounded-sm bg-surface-subtle" />
        <div className="h-24 rounded-md bg-surface-subtle" />
      </div>
    </>
  );
}

/**
 * A tela Contas: o cabeçalho, que aparece na hora, a lista das contas do contexto financeiro ao lado e, no
 * lugar do Conteúdo, o detalhe ou o formulário da subpágina (design-system.md, seção 4.1).
 */
export default function AccountsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <PageHeader
        title="Contas"
        actions={
          <Link href="/accounts/new" className={PRIMARY_BUTTON}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Nova conta
          </Link>
        }
      >
        As contas e o saldo de cada entidade do contexto escolhido.
      </PageHeader>
      <div className="grid items-start gap-8 px-4 py-8 lg:grid-cols-3 lg:px-10">
        <Suspense fallback={<AccountsSkeleton />}>
          <AccountsBody>{children}</AccountsBody>
        </Suspense>
      </div>
    </>
  );
}
