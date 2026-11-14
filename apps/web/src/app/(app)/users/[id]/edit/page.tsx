import { getUser } from '@/api/users';

import { LoadError } from '../../../../_shell/load-error';
import { loadOrNotFound } from '../../../../_shell/load-or-not-found';
import { UserEditForm } from '../../user-edit-form';

/** A edição do nome e do e-mail do usuário, no lugar do detalhe, com a lista ao lado. */
export default async function EditUser({ params }: PageProps<'/users/[id]/edit'>) {
  const { id } = await params;
  const user = await loadOrNotFound(() => getUser(id));
  if (!user) return <LoadError>Não foi possível carregar o usuário.</LoadError>;
  return <UserEditForm user={user} />;
}
