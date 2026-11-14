import type { Entity } from '@/api/entities';

import { formatTaxId, maskCpf, TYPE_BADGES } from './tax-id-format';

/** Uma entidade como a lista a mostra, já formatada. */
export interface EntityListItem {
  readonly id: string;
  readonly name: string;
  /** O selo: o tipo (PF ou PJ), ou "Desativada". */
  readonly badge: string;
  /** A segunda linha: o documento, a operação ligada ou, na desativada, o tipo. */
  readonly detail: string;
  readonly active: boolean;
}

/** A segunda linha do item: o tipo na desativada, a operação ligada, ou o documento. */
function detailOf(entity: Entity): string {
  if (!entity.active) return TYPE_BADGES[entity.type];
  if (entity.type === 'company' && entity.operations.includes('clinic')) return 'Operação: Clínica';
  if (!entity.taxId) return 'Sem documento';
  return entity.type === 'individual' ? maskCpf(entity.taxId) : formatTaxId('company', entity.taxId);
}

/**
 * A entidade como a lista a mostra (design-system.md, seção 3): o CPF completo não vai ao navegador, só
 * mascarado na segunda linha.
 */
export function entityListItem(entity: Entity): EntityListItem {
  return {
    id: entity.id,
    name: entity.name,
    active: entity.active,
    badge: entity.active ? TYPE_BADGES[entity.type] : 'Desativada',
    detail: detailOf(entity),
  };
}
