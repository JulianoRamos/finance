import { listEntities } from '@/api/entities';
import { getFinancialGroup } from '@/api/financial-groups';

import { formatDate } from '../../../_shell/format';
import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { GroupForm } from '../group-form';
import { memberOptions } from '../member-options';

/** Os membros da Visão Familiar, ou o formulário de um grupo do usuário, com a lista ao lado. */
export default async function FinancialGroupDetail({ params }: PageProps<'/financial-groups/[id]'>) {
  const { id } = await params;
  // As duas buscas não dependem uma da outra.
  const [group, entities] = await Promise.all([loadOrNotFound(() => getFinancialGroup(id)), listEntities()]);
  const options = group && memberOptions(entities, group);
  if (!group || !options) return <LoadError>Não foi possível carregar o grupo.</LoadError>;
  return <GroupForm group={group} createdOn={formatDate(group.createdAt)} options={options} />;
}
