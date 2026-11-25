import 'server-only';

import { type DataResult, dataResult, MAX_PAGE_SIZE, type ReadResult, readAllPages, readResult } from './api-error';
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

/**
 * A página da árvore de uma natureza, com a busca e o total de cada categoria no mês `AAAA-MM`; com
 * `onlyActive`, só as ativas.
 */
export async function listCategories(query: {
  nature: CategoryNature;
  page: number;
  q: string;
  onlyActive: boolean;
  month: string;
}): Promise<CategoryList> {
  const result = await dataResult((signal) =>
    api.GET('/v1/categories', {
      params: {
        query: {
          nature: query.nature,
          page: query.page,
          pageSize: PAGE_SIZE,
          q: query.q,
          month: query.month,
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

/** Todas as categorias de primeiro nível ativas da natureza, pelo nome, com as subcategorias ativas, lidas de 100 em 100. */
function listActiveTree(nature: CategoryNature): Promise<ReadResult<CategoryTreeItem[]>> {
  return readAllPages(
    (page) =>
      readResult((init) =>
        api.GET('/v1/categories', {
          params: { query: { nature, page, pageSize: MAX_PAGE_SIZE, active: true } },
          ...init,
        }),
      ),
    (item) => item,
  );
}

/**
 * Todas as categorias de primeiro nível ativas da natureza, pelo nome, que o "Mover para…" oferece como o
 * novo pai.
 */
export async function listParentChoices(nature: CategoryNature): Promise<ReadResult<ParentChoice[]>> {
  const tree = await listActiveTree(nature);
  return tree.status === 'ok' ? { status: 'ok', data: tree.data.map(({ id, name }) => ({ id, name })) } : tree;
}

/** Uma escolha de categoria de um lançamento: o id, o nome e o nome do pai, para o caminho. */
export interface CategoryChoice {
  readonly id: string;
  readonly name: string;
  readonly parentName: string | null;
}

/**
 * As categorias ativas da natureza que um lançamento pode escolher, na ordem da árvore: cada uma de
 * primeiro nível seguida das subcategorias dela.
 */
export async function listCategoryChoices(nature: CategoryNature): Promise<ReadResult<CategoryChoice[]>> {
  const tree = await listActiveTree(nature);
  if (tree.status !== 'ok') return tree;
  return {
    status: 'ok',
    data: tree.data.flatMap((parent) => [
      { id: parent.id, name: parent.name, parentName: null },
      ...parent.children.map((child) => ({ id: child.id, name: child.name, parentName: parent.name })),
    ]),
  };
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
