import Link from 'next/link';

import { getAccount } from '@/api/accounts';

import { accountBadge, accountSummary } from '../../../_shell/account-text';
import { PRIMARY_BUTTON } from '../../../_shell/buttons';
import { formatCalendarDate } from '../../../_shell/format';
import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { formatMoney } from '../../../_shell/money';
import { AccountHistory } from './account-history';
import { ActivationForm } from './activation-form';

const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';

/**
 * O detalhe da conta: o nome, o tipo, o banco e a entidade dona, o saldo inicial com a data e as ações. O
 * saldo de hoje e as movimentações entram com as movimentações.
 */
export default async function AccountDetail({ params }: PageProps<'/accounts/[id]'>) {
  const { id } = await params;
  const account = await loadOrNotFound(() => getAccount(id));
  if (!account) return <LoadError>Não foi possível carregar a conta.</LoadError>;
  const negative = account.openingBalance.startsWith('-');
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
        <div className="flex flex-1 basis-40 flex-col gap-1 rounded-md border border-hairline px-4 py-3">
          <span className="text-body-sm text-mute">Saldo inicial</span>
          <span className={`text-heading-md tabular-nums ${negative ? 'text-negative' : 'text-ink'}`}>
            {formatMoney(account.openingBalance)}
          </span>
          <span className="text-body-sm text-mute tabular-nums">
            em {formatCalendarDate(account.openingBalanceDate)}
          </span>
        </div>
      </div>
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
