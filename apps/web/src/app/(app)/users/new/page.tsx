import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { currentSession } from '@/api/sessions';
import { listUserPermissions } from '@/api/users';

import { LoadError } from '../../../_shell/load-error';
import { NewUserForm } from '../new-user-form';

/**
 * O cadastro de um usuário, no lugar do detalhe, com o item dele no topo da lista. A tabela de
 * permissões lista todas as entidades pela rota das permissões de quem cadastra, que traz todas, com a
 * busca e a ordem da lista das entidades; o usuário novo começa sem acesso a nenhuma.
 */
export default async function NewUser() {
  await connection();
  const session = await currentSession();
  if (session.status === 'unauthenticated') redirect('/login');
  if (session.status !== 'authenticated') return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  const entities = await listUserPermissions(session.user.id);
  if (entities.status === 'unauthenticated') redirect('/login');
  if (entities.status !== 'ok') return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  return <NewUserForm listedBy={session.user.id} entities={entities.data} />;
}
