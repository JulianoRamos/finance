import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listUsers } from '@/api/users';

import { OpenPage } from '../../_shell/open-page';

/** A tela Usuários e acessos abre o primeiro usuário da primeira página: há sempre ao menos quem a abriu. */
export default async function Users() {
  await connection();
  const list = await listUsers();
  if (list.status === 'unauthenticated') redirect('/login');
  // Sem a lista, a Coluna já mostra o erro de carregamento, ou o layout, a página não encontrada.
  if (list.status !== 'ok') return null;
  const [first] = list.data.items;
  return first ? <OpenPage href={`/users/${first.id}`} /> : null;
}
