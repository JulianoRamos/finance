import type { EntityType } from '@/api/entities';

import { TYPE_BADGES } from './tax-id-format';

const BADGE = 'flex-none rounded-full px-2 text-body-sm font-medium';

/** O selo da entidade: o tipo (PF ou PJ), ou "Desativada" na entidade desativada. */
export function EntityBadge({
  entity,
  className = '',
}: Readonly<{ entity: { readonly type: EntityType; readonly active: boolean }; className?: string }>) {
  if (!entity.active) return <span className={`${BADGE} bg-surface-subtle text-body ${className}`}>Desativada</span>;
  return <span className={`${BADGE} bg-accent-soft text-link ${className}`}>{TYPE_BADGES[entity.type]}</span>;
}
