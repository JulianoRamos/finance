import 'server-only';

import { redirect } from 'next/navigation';

import type { EntityList } from '@/api/entities';
import type { FinancialGroup } from '@/api/financial-groups';

import type { MemberOption } from './group-form';

/**
 * As entidades que o formulário oferece: as ativas, na ordem da lista das entidades, e as desativadas
 * que já estão no grupo, que podem sair e não voltam (regra 6.2). Nulo quando a api não respondeu.
 */
export function memberOptions(list: EntityList, group?: FinancialGroup): MemberOption[] | null {
  if (list.status === 'unauthenticated') redirect('/login');
  if (list.status !== 'ok') return null;
  const members = new Set(group?.members.map((member) => member.id));
  return list.data
    .filter((entity) => entity.active || members.has(entity.id))
    .map(({ id, name, type, active }) => ({ id, name, type, active }));
}
