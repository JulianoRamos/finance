import type { Entity } from '@/api/entities';

/** Uma entidade como as escolhas dos formulários a oferecem: os membros de um grupo e o sócio de uma participação. */
export type EntityOption = Pick<Entity, 'id' | 'type' | 'name' | 'active'>;

/** A entidade como opção de uma escolha. */
export function entityOption({ id, type, name, active }: Entity): EntityOption {
  return { id, type, name, active };
}
