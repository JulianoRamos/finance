import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { type Account, type AccountBalance, getAccount, getAccountBalance, listMovements } from '@/api/accounts';
import type { DataResult } from '@/api/api-error';

import { accountBadge, accountSummary } from '../../../_shell/account-text';
import { PRIMARY_BUTTON } from '../../../_shell/buttons';
import { endOfPreviousMonth, formatCalendarDate, isCalendarDate, todayCalendarDate } from '../../../_shell/format';
import { lastPageOf, requestedPage } from '../../../_shell/list-page';
import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { MoneyValue } from '../../../_shell/money-value';
import { AccountHistory } from './account-history';
import { ActivationForm } from './activation-form';
import { BalanceDateField } from './balance-date-field';
import { balanceOnDate } from './balance-on-date';
import { Movements } from './movements';

const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';

const CARD = 'flex flex-1 basis-40 flex-col gap-1 rounded-md border border-hairline px-4 py-3';
const CARD_VALUE = 'text-heading-md';

/**
 * Um cartão de saldo: o rótulo, que dá nome ao grupo, o valor e a linha de baixo. Com `htmlFor`, o rótulo é
 * o do campo que o cartão traz.
 */
function BalanceCard({
  id,
  label,
  htmlFor,
  children,
}: Readonly<{ id: string; label: string; htmlFor?: string; children: ReactNode }>) {
  const labelClass = 'text-body-sm text-mute';
  return (
    <div role="group" aria-labelledby={id} className={CARD}>
      {htmlFor ? (
        <label id={id} htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span id={id} className={labelClass}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

/** O que o "Saldo em" mostra no lugar do valor: o saldo, ou por que não há. */
function BalanceOn({ account, balance }: Readonly<{ account: Account; balance: DataResult<AccountBalance> }>) {
  if (balance.ok) return <MoneyValue amount={balance.data.balance} className={CARD_VALUE} />;
  if (balance.code === 'UNAUTHENTICATED') redirect('/login');
  return (
    <span className="text-body-sm text-mute">
      {balance.code === 'DATE_BEFORE_OPENING_BALANCE'
        ? `Sem saldo nesse dia: a conta começa em ${formatCalendarDate(account.openingBalanceDate)}.`
        : 'Não foi possível carregar o saldo nessa data.'}
    </span>
  );
}

/**
 * O detalhe da conta: o nome, o tipo, o banco e a entidade dona, o saldo de hoje, o saldo numa data, o
 * saldo inicial, as movimentações e as ações. A data do "Saldo em" e a página das movimentações ficam no
 * endereço (`?balanceDate=` e `?page=`); sem data, o saldo é o do último dia do mês anterior.
 */
export default async function AccountDetail({ params, searchParams }: PageProps<'/accounts/[id]'>) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const page = requestedPage(query.page);
  const today = todayCalendarDate();
  const balanceDate =
    typeof query.balanceDate === 'string' && isCalendarDate(query.balanceDate)
      ? query.balanceDate
      : endOfPreviousMonth(today);
  // As três buscas não dependem uma da outra; a do id decide se a página existe.
  const [account, movements, balance] = await Promise.all([
    loadOrNotFound(() => getAccount(id)),
    listMovements(id, page),
    getAccountBalance(id, balanceDate),
  ]);
  if (!account) return <LoadError>Não foi possível carregar a conta.</LoadError>;
  if (movements.status === 'unauthenticated') redirect('/login');
  // A página que ficou vazia, como uma página antiga no endereço, vai para a última com movimentações.
  const lastPage = movements.status === 'ok' ? lastPageOf(movements.data) : null;
  if (lastPage !== null) {
    // Só a página muda: a data do saldo fica como veio, e sem ela o padrão continua a acompanhar o mês.
    const kept = typeof query.balanceDate === 'string' ? { balanceDate: query.balanceDate } : {};
    redirect(`/accounts/${account.id}?${new URLSearchParams({ ...kept, page: String(lastPage) }).toString()}`);
  }
  const badge = accountBadge(account);

  return (
    <section aria-labelledby="account-title" className={PANEL}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="account-title" className="text-heading-md wrap-anywhere text-ink">
              {account.name}
            </h2>
            {badge && (
              <span
                className={`rounded-full px-2 text-body-sm font-medium ${account.active ? 'bg-accent-soft text-link' : 'bg-surface-subtle text-body'}`}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="wrap-anywhere">{accountSummary(account)}</p>
        </div>
        <AccountHistory accountId={account.id} accountName={account.name} />
      </div>
      {!account.active && (
        <p className="text-body-sm text-mute">
          Esta conta está desativada: ela não aparece nas escolhas de conta e continua nos números.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <BalanceCard id="balance-today-label" label="Saldo hoje">
          <MoneyValue amount={account.balance} className={CARD_VALUE} />
          <span className="text-body-sm text-mute tabular-nums">{formatCalendarDate(today)}</span>
        </BalanceCard>
        <BalanceCard id="balance-on-label" label="Saldo em" htmlFor="balance-date">
          <BalanceOn account={account} balance={balance} />
          <BalanceDateField id="balance-date" date={balanceDate} />
        </BalanceCard>
        <BalanceCard id="opening-balance-label" label="Saldo inicial">
          <MoneyValue amount={account.openingBalance} className={CARD_VALUE} />
          <span className="text-body-sm text-mute tabular-nums">
            em {formatCalendarDate(account.openingBalanceDate)}
          </span>
        </BalanceCard>
      </div>
      {movements.status === 'ok' ? (
        <Movements
          account={account}
          movements={movements.data}
          today={today}
          balanceOn={{ date: balanceDate, result: balanceOnDate(balance) }}
        />
      ) : (
        <LoadError>Não foi possível carregar as movimentações.</LoadError>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-hairline pt-4">
        <ActivationForm
          accountId={account.id}
          accountName={account.name}
          version={account.version}
          active={account.active}
        />
        <Link href={`/accounts/${account.id}/edit`} className={`${PRIMARY_BUTTON} max-md:w-full`}>
          Editar dados
        </Link>
      </div>
    </section>
  );
}
