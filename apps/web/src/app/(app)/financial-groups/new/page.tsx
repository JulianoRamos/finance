import { connection } from 'next/server';

import { listEntities } from '@/api/entities';

import { LoadError } from '../../../_shell/load-error';
import { GroupForm } from '../group-form';
import { memberOptions } from '../member-options';

/** A criação de um grupo, no lugar do Conteúdo, com o item dele no topo da lista. */
export default async function NewFinancialGroup() {
  await connection();
  const options = memberOptions(await listEntities());
  if (!options) return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  return <GroupForm options={options} />;
}
