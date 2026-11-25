import 'server-only';

import { type DataResult, dataResult, type ReadResult, readResult } from './api-error';
import { api } from './client';
import type { components } from './schema';

export type Category = components['schemas']['Category'];
export type CategoryNature = Category['nature'];
export type CategoryTreeItem = components['schemas']['CategoryTreeItem'];
export type CategoryTreePage = components['schemas']['CategoryTreePage'];

/** Uma escolha de pai: uma categoria de primeiro nível, pelo id e pelo nome. */
export type ParentChoice = Pick<Category, 'id' | 'name'>;
type NewCategory = components['schemas']['NewCategory'];
export type CategoryEdit = components['schemas']['CategoryEdit'];

/** O tamanho da página da árvore, pelas categorias de primeiro nível (design-system.md, seção 4.6). */
const PAGE_SIZE = 10;
/** O maior tamanho de página que a api aceita, para ler todas as categorias de primeiro nível. */
const MAX_PAGE_SIZE = 100;

/**
 * O que a leitura da árvore devolve: a página; `forbidden` quando o usuário não tem permissão em nenhuma
 * pessoa física, e a árvore é delas (LLD, seção 4.6); `unauthenticated` sem uma sessão válida; ou
 * `unavailable` quando a api não respondeu como o contrato diz.
 */
export type CategoryList =
  | { status: 'ok'; data: CategoryTreePage }
  | { status: 'forbidden' }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

/** A página da árvore de uma natureza, com a busca; com `onlyActive`, só as ativas. */
export async function listCategories(query: {
  nature: CategoryNature;
  page: number;
  q: string;
  onlyActive: boolean;
}): Promise<CategoryList> {
  const result = await dataResult((signal) =>
    api.GET('/v1/categories', {
      params: {
        query: {
          nature: query.nature,
          page: query.page,
          pageSize: PAGE_SIZE,
          q: query.q,
          ...(query.onlyActive && { active: true }),
        },
      },
      cache: 'no-store',
      signal,
    }),
  );
  if (result.ok) return { status: 'ok', data: result.data };
  if (result.code === 'UNAUTHENTICATED') return { status: 'unauthenticated' };
  return { status: result.code === 'FORBIDDEN' ? 'forbidden' : 'unavailable' };
}

/**
 * Todas as categorias de primeiro nível ativas da natureza, pelo nome, que o "Mover para…" oferece como o
 * novo pai, lidas de 100 em 100.
 */
export async function listParentChoices(nature: CategoryNature): Promise<ReadResult<ParentChoice[]>> {
  const choices: ParentChoice[] = [];
  for (let page = 1; ; page++) {
    const result = await readResult((init) =>
      api.GET('/v1/categories', {
        params: { query: { nature, page, pageSize: MAX_PAGE_SIZE, active: true } },
        ...init,
      }),
    );
    if (result.status !== 'ok') return result;
    choices.push(...result.data.items.map(({ id, name }) => ({ id, name })));
    if (choices.length >= result.data.total || result.data.items.length === 0) return { status: 'ok', data: choices };
  }
}

/** O resultado de um comando sobre uma categoria: ela, como ficou, ou o erro do contrato. */
type CategoryResult = DataResult<Category>;

/** Cria uma categoria de primeiro nível, com a natureza, ou uma subcategoria, com o pai. */
export function createCategory(body: NewCategory): Promise<CategoryResult> {
  return dataResult((signal) => api.POST('/v1/categories', { body, signal }));
}

/** Renomeia a categoria ou muda o pai dela, com a versão lida. A natureza vai igual: ela não muda. */
export function updateCategory(id: string, body: CategoryEdit): Promise<CategoryResult> {
  return dataResult((signal) => api.PUT('/v1/categories/{id}', { params: { path: { id } }, body, signal }));
}

/** Desativa ou reativa uma categoria, com a versão lida. */
export function setCategoryActive(id: string, active: boolean, version: number): Promise<CategoryResult> {
  return dataResult((signal) =>
    api.PUT('/v1/categories/{id}/active', { params: { path: { id } }, body: { active, version }, signal }),
  );
}
