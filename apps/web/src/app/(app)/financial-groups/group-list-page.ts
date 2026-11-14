import type { FinancialGroup } from '@/api/financial-groups';

import { groupSummary } from './group-summary';

/** Um grupo como a lista o mostra, com a segunda linha já escrita. */
export interface GroupListItem {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
}

/** O grupo como a lista o mostra. */
export function groupListItem(group: FinancialGroup): GroupListItem {
  return { id: group.id, name: group.name, summary: groupSummary(group) };
}
