import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listAccountChoices } from '@/api/accounts';
import { listCategoryChoices } from '@/api/categories';
import { currentFinancialContext } from '@/api/financial-context';

import { dayBefore, todayCalendarDate } from '../../../_shell/format';
import { LoadError } from '../../../_shell/load-error';
import { EntryForm } from '../entry-form';
import { NoIndividualNotice } from './no-individual-notice';

/**
 * O registro de um lançamento, no lugar do detalhe, com o item dele no topo da lista. A entidade é uma das
 * pessoas físicas ativas do contexto financeiro, e a única já vem escolhida; a conta, uma das ativas dela; e
 * a categoria, uma das ativas da natureza do tipo. Sem nenhuma pessoa física, a tela diz o motivo e
 * oferece a troca do contexto.
 */
export default async function NewEntry() {
  await connection();
  const [context, accounts, expense, revenue] = await Promise.all([
    currentFinancialContext(),
    listAccountChoices(),
    listCategoryChoices('expense'),
    listCategoryChoices('revenue'),
  ]);
  if (context.status === 'unauthenticated' || accounts.status === 'unauthenticated') redirect('/login');
  if (context.status === 'unavailable') return <LoadError>Não foi possível carregar as entidades.</LoadError>;
  const individuals =
    context.status === 'ok'
      ? context.context.entities
          .filter((entity) => entity.type === 'individual' && entity.active)
          .map((entity) => ({ id: entity.id, name: entity.name }))
      : [];
  if (individuals.length === 0) return <NoIndividualNotice />;
  if (accounts.status !== 'ok' || expense.status !== 'ok' || revenue.status !== 'ok') {
    return <LoadError>Não foi possível carregar as contas e as categorias.</LoadError>;
  }
  const today = todayCalendarDate();
  return (
    <EntryForm
      individuals={individuals}
      accounts={accounts.data}
      categories={{ expense: expense.data, revenue: revenue.data }}
      today={today}
      yesterday={dayBefore(today)}
    />
  );
}
