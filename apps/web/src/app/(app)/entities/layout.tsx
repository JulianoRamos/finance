import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { type Entity, type EntityList as EntityListResult, listEntities } from '@/api/entities';

import { ErrorNotice } from '../../_access/fields';
import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { EntityList, type EntityListItem } from './entity-list';
import { formatTaxId, maskCpf, TYPE_BADGES } from './tax-id-format';

export const metadata: Metadata = { title: 'Entidades · finance' };

/** O que a lista mostra de cada entidade (design-system.md, seção 3: o CPF mascarado). */
function listItemOf(entity: Entity): EntityListItem {
  const { id, name, active, type } = entity;
  // O CPF completo não vai ao navegador: a lista o mostra mascarado, e a busca acha pelo CNPJ.
  const taxId = type === 'company' ? entity.taxId : null;
  return { id, name, active, taxId, badge: active ? TYPE_BADGES[type] : 'Desativada', detail: detailOf(entity) };
}

/** A segunda linha do item: o tipo na desativada, a operação ligada, ou o documento. */
function detailOf(entity: Entity): string {
  if (!entity.active) return TYPE_BADGES[entity.type];
  if (entity.type === 'company' && entity.operations.includes('clinic')) return 'Operação: Clínica';
  if (!entity.taxId) return 'Sem documento';
  return entity.type === 'individual' ? maskCpf(entity.taxId) : formatTaxId('company', entity.taxId);
}

/** O conteúdo da Coluna: a lista, ou o erro de carregamento. */
function ListBody({ list }: Readonly<{ list: Exclude<EntityListResult, { status: 'unauthenticated' }> }>) {
  if (list.status === 'unavailable') return <ErrorNotice>Não foi possível carregar as entidades.</ErrorNotice>;
  return <EntityList items={list.entities.map(listItemOf)} />;
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
