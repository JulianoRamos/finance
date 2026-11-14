import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listEntities } from '@/api/entities';

import { mapPage } from '../../../_shell/list-page';
import { LoadError } from '../../../_shell/load-error';
import { GroupForm } from '../group-form';
import { memberOption } from '../member-options';

/** A criação de um grupo, no lugar do Conteúdo, com o item dele no topo da lista. */
export default async function NewFinancialGroup() {
  await connection();
  const entities = await listEntities(1, '', true);
  if (entities.status === 'unauthenticated') redirect('/login');
  if (entities.status !== 'ok') return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  return <GroupForm options={mapPage(entities.data, memberOption)} inactive={[]} />;
}
