import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { type EntityList as EntityListResult, listEntities } from '@/api/entities';

import { ErrorNotice } from '../../_access/fields';
import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { mapPage } from '../../_shell/list-page';
import { EntityList } from './entity-list';
import { entityListItem } from './entity-list-page';

export const metadata: Metadata = { title: 'Entidades · finance' };

/** O conteúdo da Coluna: a lista, ou o erro de carregamento. */
function ListBody({ list }: Readonly<{ list: EntityListResult }>) {
  if (list.status !== 'ok') return <ErrorNotice>Não foi possível carregar as entidades.</ErrorNotice>;
  return <EntityList initial={mapPage(list.data, entityListItem)} />;
}

/**
 * A tela Entidades: o cabeçalho, a lista ao lado e, no lugar do Conteúdo, o detalhe ou o formulário
 * da subpágina (design-system.md, seção 4.1).
 */
export default async function EntitiesLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const list = await listEntities();
  if (list.status === 'unauthenticated') redirect('/login');

  return (
    <>
      <PageHeader
        title="Entidades"
        actions={
          <Link href="/entities/new" className={PRIMARY_BUTTON}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Nova entidade
          </Link>
        }
      >
        As pessoas físicas e jurídicas cujas finanças o sistema controla.
      </PageHeader>
      <div className="grid items-start gap-8 px-4 py-8 lg:grid-cols-3 lg:px-10">
        <section
          aria-label="Lista de entidades"
          className="flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4"
        >
          <ListBody list={list} />
        </section>
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">{children}</div>
      </div>
    </>
  );
}
