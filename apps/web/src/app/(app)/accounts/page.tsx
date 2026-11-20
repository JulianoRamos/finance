import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listAccounts } from '@/api/accounts';

import { OpenPage } from '../../_shell/open-page';

/**
 * A tela Contas abre a primeira conta da primeira página a partir do tablet, onde a lista e o item cabem
 * juntos; no celular, a página é a lista. Sem nenhuma conta, o layout mostra o estado vazio.
 */
export default async function Accounts() {
  await connection();
  const list = await listAccounts();
  if (list.status === 'unauthenticated') redirect('/login');
  const first = list.status === 'ok' ? list.data.items[0] : undefined;
  return first ? <OpenPage href={`/accounts/${first.id}`} media="(min-width: 768px)" /> : null;
}
