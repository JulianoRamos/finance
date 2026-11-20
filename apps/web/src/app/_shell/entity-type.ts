import type { EntityType } from '@/api/entities';

/** A sigla do tipo da entidade, como o selo da lista e o da paleta de pesquisa a mostram. */
export const TYPE_BADGES: Readonly<Record<EntityType, string>> = { individual: 'PF', company: 'PJ' };
