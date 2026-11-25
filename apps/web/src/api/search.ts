import 'server-only';

import { type ReadResult, readResult } from './api-error';
import { api } from './client';
import type { components } from './schema';

export type SearchResults = components['schemas']['SearchResults'];
export type SearchEntity = SearchResults['entities'][number];
export type SearchFinancialGroup = SearchResults['financialGroups'][number];
export type SearchAccount = SearchResults['accounts'][number];
export type SearchUser = SearchResults['users'][number];

/**
 * A pesquisa da paleta (regra 6.22): até 5 entidades, grupos, contas, categorias e usuários cujo nome tem o termo, em todos
 * os contextos do usuário.
 */
export function search(term: string): Promise<ReadResult<SearchResults>> {
  return readResult((init) => api.GET('/v1/search', { params: { query: { term } }, ...init }));
}
