import { redirect } from 'next/navigation';

import type { ReadResult } from '@/api/api-error';

// A página das listas (LLD, seção 5), como a tela a mostra: o servidor a lê da api e a converte, e a
// lista do cliente pede as outras páginas por uma ação do servidor.

/** Uma página de uma lista, como o contrato a devolve, com os itens já prontos para a tela. */
export interface ListPage<Item> {
  readonly items: readonly Item[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** O que o pedido de uma página devolve: ela, ou a falha, que a lista avisa. */
export type ListPageResult<Item> = { readonly ok: true; readonly page: ListPage<Item> } | { readonly ok: false };

/** A página com cada item convertido para a tela. */
export function mapPage<From, To>(page: ListPage<From>, convert: (item: From) => To): ListPage<To> {
  return { items: page.items.map(convert), total: page.total, page: page.page, pageSize: page.pageSize };
}

/** A página lida, convertida para a tela, numa ação do servidor; sem sessão, vai para o login. */
export function listPageResult<From, To>(
  list: ReadResult<ListPage<From>>,
  convert: (item: From) => To,
): ListPageResult<To> {
  if (list.status === 'unauthenticated') redirect('/login');
  return list.status === 'ok' ? { ok: true, page: mapPage(list.data, convert) } : { ok: false };
}
