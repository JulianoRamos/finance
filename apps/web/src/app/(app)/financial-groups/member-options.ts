import type { FinancialGroup } from '@/api/financial-groups';

import type { MemberOption } from './group-form';

/**
 * As desativadas que já estão no grupo: elas ficam acima da página das ativas, que não as traz, e
 * podem sair do grupo, mas não voltam (regra 6.2).
 */
export function inactiveMembers(group?: FinancialGroup): MemberOption[] {
  return group?.members.filter((member) => !member.active) ?? [];
}
