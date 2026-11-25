import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';

import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { currentMonth } from '../../_shell/format';
import { listEntriesAction } from './actions';
import { EntryColumns } from './entry-columns';
import { EntryList } from './entry-list';
import { entryParams } from './entry-text';

export const metadata: Metadata = { title: 'Lançamentos · finance' };

/**
 * A Coluna e o Conteúdo depois de a lista do mês corrente, sem filtro, chegar; a Coluna pede outro estado
 * do endereço à api.
 */
async function EntriesBody({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const month = currentMonth();
  const list = await listEntriesAction(entryParams(() => undefined, month));
  return (
    <EntryColumns list={list.ok ? <EntryList initial={list.page} currentMonth={month} /> : null}>
      {children}
    </EntryColumns>
  );
}

/**
 * A Coluna e o Conteúdo enquanto a lista carrega: blocos cinza no formato deles, e não um indicador girando
 * (design-system.md, seção 4.5).
 */
function EntriesSkeleton() {
  return (
    <>
      <section
        aria-label="Carregando os lançamentos"
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
 * A tela Lançamentos: o cabeçalho, que aparece na hora, a lista do mês das pessoas físicas do contexto ao
 * lado e, no lugar do Conteúdo, o detalhe ou o formulário da subpágina (design-system.md, seção 4.1).
 */
export default function EntriesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <PageHeader
        title="Lançamentos"
        actions={
          <Link href="/entries/new" className={PRIMARY_BUTTON}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Novo lançamento
          </Link>
        }
      >
        As receitas e as despesas das pessoas físicas do contexto escolhido, com as parcelas de cada uma.
      </PageHeader>
      <div className="grid items-start gap-8 px-4 py-8 lg:grid-cols-3 lg:px-10">
        <Suspense fallback={<EntriesSkeleton />}>
          <EntriesBody>{children}</EntriesBody>
        </Suspense>
      </div>
    </>
  );
}
