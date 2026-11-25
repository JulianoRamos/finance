import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listEntries } from '@/api/entries';

import { currentMonth } from '../../_shell/format';
import { OpenPage } from '../../_shell/open-page';
import { entriesQuery, entryParams } from './entry-text';

/**
 * A tela Lançamentos abre o lançamento da primeira parcela da página do estado do endereço a partir do
 * tablet, onde a lista e o item cabem juntos; no celular, a página é a lista. Sem nenhum, a Coluna mostra o
 * estado vazio.
 */
export default async function Entries({ searchParams }: PageProps<'/entries'>) {
  await connection();
  const month = currentMonth();
  const search = await searchParams;
  const params = entryParams((key) => search[key], month);
  const list = await listEntries(params);
  if (list.status === 'unauthenticated') redirect('/login');
  const first = list.status === 'ok' ? list.data.items[0] : undefined;
  return first ? (
    <OpenPage href={`/entries/${first.entryId}${entriesQuery(params, month)}`} media="(min-width: 768px)" />
  ) : null;
}
