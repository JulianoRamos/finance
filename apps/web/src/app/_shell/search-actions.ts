'use server';

import { redirect } from 'next/navigation';

import { search, type SearchResults } from '@/api/search';

/**
 * Os registros da pesquisa da paleta, pedidos à api; nulo quando ela não responde como o contrato diz. Sem
 * uma sessão válida, vai para o login.
 */
export async function searchAction(term: string): Promise<SearchResults | null> {
  const result = await search(term);
  if (result.status === 'unauthenticated') redirect('/login');
  return result.status === 'ok' ? result.data : null;
}
