import { redirect } from 'next/navigation';

import { currentFinancialContext } from '@/api/financial-context';

import { LoadError } from '../../../_shell/load-error';
import { AccountForm } from '../account-form';

/**
 * A criação de uma conta, no lugar do detalhe, com o item dela no topo da lista. A entidade dona é
 * escolhida entre as ativas do contexto financeiro, e a única já vem escolhida.
 */
export default async function NewAccount() {
  const context = await currentFinancialContext();
  if (context.status === 'unauthenticated') redirect('/login');
  if (context.status === 'unavailable') return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  const owners =
    context.status === 'ok'
      ? context.context.entities
          .filter((entity) => entity.active)
          .map((entity) => ({ id: entity.id, name: entity.name }))
      : [];
  return <AccountForm owners={owners} />;
}
