import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { listFinancialGroups } from '@/api/financial-groups';

import { ErrorNotice } from '../../_access/fields';
import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { GroupList } from './group-list';
import { groupSummary } from './group-summary';

export const metadata: Metadata = { title: 'Grupos financeiros · finance' };

/**
 * A tela Grupos financeiros: o cabeçalho, a lista ao lado e, no lugar do Conteúdo, os membros da
 * Visão Familiar ou o formulário de um grupo (design-system.md, seção 4.1).
 */
export default async function FinancialGroupsLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const list = await listFinancialGroups();
  if (list.status === 'unauthenticated') redirect('/login');

  return (
    <>
      <PageHeader
        title="Grupos financeiros"
        actions={
          <Link href="/financial-groups/new" className={PRIMARY_BUTTON}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Novo grupo
          </Link>
        }
      >
        Conjuntos de entidades vistos juntos no seletor de contexto.
      </PageHeader>
      <div className="grid items-start gap-8 px-4 py-8 lg:grid-cols-3 lg:px-10">
        <section
          aria-label="Lista de grupos"
          className="flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4"
        >
          {list.status === 'ok' ? (
            <GroupList
              items={list.data.map((group) => ({ id: group.id, name: group.name, summary: groupSummary(group) }))}
            />
          ) : (
            <ErrorNotice>Não foi possível carregar os grupos.</ErrorNotice>
          )}
        </section>
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">{children}</div>
      </div>
    </>
  );
}
