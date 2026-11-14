import { notFound } from 'next/navigation';

import { currentSession } from '@/api/sessions';
import { getUser, listUserPermissions } from '@/api/users';

import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { UserDetail } from './user-detail';

/** O detalhe do usuário: os dados, o gerir acessos, a tabela de permissões e as ações. */
export default async function UserDetailPage({ params }: PageProps<'/users/[id]'>) {
  const { id } = await params;
  // As duas leituras não dependem uma da outra: correm juntas.
  const [user, permissions] = await Promise.all([loadOrNotFound(() => getUser(id)), listUserPermissions(id)]);
  if (permissions.status === 'not-found') notFound();
  if (!user || permissions.status !== 'ok') return <LoadError>Não foi possível carregar o usuário.</LoadError>;
  const session = await currentSession();
  const selfId = session.status === 'authenticated' ? session.user.id : null;
  return (
    // A versão na chave recompõe as escolhas não salvas depois de cada gravação, com o usuário lido de novo.
    <UserDetail key={user.version} user={user} self={user.id === selfId} permissions={permissions.data} />
  );
}
