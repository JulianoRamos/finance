import { getAccount } from '@/api/accounts';

import { LoadError } from '../../../../_shell/load-error';
import { loadOrNotFound } from '../../../../_shell/load-or-not-found';
import { AccountForm } from '../../account-form';

/** A edição da conta, no lugar do detalhe, com a lista ao lado. */
export default async function EditAccount({ params }: PageProps<'/accounts/[id]/edit'>) {
  const { id } = await params;
  const account = await loadOrNotFound(() => getAccount(id));
  if (!account) return <LoadError>Não foi possível carregar a conta.</LoadError>;
  return <AccountForm account={account} />;
}
