import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { type AccountChoice, listAccountChoices } from '@/api/accounts';
import { type Entry, getEntry, type InstallmentPage, listInstallments } from '@/api/entries';
import { listInstallmentPayments } from '@/api/installment-payments';

import { dayBefore, formatCalendarDate, todayCalendarDate } from '../../../_shell/format';
import { requestedPage } from '../../../_shell/list-page';
import { LoadError } from '../../../_shell/load-error';
import { loadOrNotFound } from '../../../_shell/load-or-not-found';
import { MoneyValue } from '../../../_shell/money-value';
import { UrlPagination } from '../../../_shell/url-pagination';
import { categoryPath } from '../../../_shell/category-text';
import { type InstallmentStatus, numberText, OCCURRED_ON_LABELS, PURPOSE_NAMES, TYPE_NAMES } from '../entry-text';
import { StatusBadge } from '../installment-status';
import { InstallmentActions, type MenuPayment } from './installment-actions';

const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';
const HEAD = 'py-2 text-label text-mute';
const CELL = 'border-t border-hairline py-2';

/** O parâmetro do endereço da página das parcelas, que não se confunde com o da página da lista. */
const INSTALLMENTS_PAGE = 'installmentsPage';

/** Um dado do lançamento: o nome e o valor. */
function Datum({ term, children }: Readonly<{ term: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-body-sm text-mute">{term}</dt>
      <dd className="wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

/** A situação da parcela e, na liquidada, o dia do pagamento, abaixo do selo. */
function Status({ status, payment }: Readonly<{ status: InstallmentStatus; payment: MenuPayment | undefined }>) {
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge status={status} />
      {payment && (
        <span className="text-body-sm text-mute tabular-nums">Pago em {formatCalendarDate(payment.date)}</span>
      )}
    </span>
  );
}

/**
 * As parcelas do lançamento: a tabela da parcela, do vencimento, da conta, do valor e da situação, de 10 em
 * 10, com a página no endereço. Abaixo de `container-table`, a tabela vira a lista estreita, com a parcela
 * e o valor na primeira linha e o vencimento, a conta e a situação na segunda (design-system.md, seção 4.4).
 */
function Installments({
  entry,
  installments,
  payments,
  accounts,
}: Readonly<{
  entry: Entry;
  installments: InstallmentPage;
  payments: ReadonlyMap<string, MenuPayment>;
  accounts: readonly AccountChoice[];
}>) {
  const caption = `Parcelas do lançamento ${entry.description}`;
  const direction = entry.type === 'revenue' ? 'inflow' : 'outflow';
  const today = todayCalendarDate();
  const days = { today, yesterday: dayBefore(today) };
  // O pagamento pede uma conta ativa da entidade dona do lançamento.
  const ownAccounts = accounts.filter((account) => account.entityId === entry.entityId);
  return (
    <section aria-labelledby="installments-title" className="flex flex-col gap-3 border-t border-hairline pt-6">
      <h3 id="installments-title" className="text-heading-sm text-ink">
        Parcelas
      </h3>
      <div className="@container">
        <ul aria-label={caption} className="flex flex-col @table:hidden">
          {installments.items.map((installment) => (
            <li key={installment.id} className="flex flex-col gap-1 border-t border-hairline py-2">
              <span className="flex items-start justify-between gap-3">
                <span className="text-ink tabular-nums">{numberText(installment.number, entry.installmentCount)}</span>
                <MoneyValue amount={installment.amount} direction={direction} />
              </span>
              <span className="flex items-start justify-between gap-3 text-body-sm">
                <span className="min-w-0 wrap-anywhere text-mute tabular-nums">
                  {formatCalendarDate(installment.dueDate)} · {installment.accountName}
                </span>
                <Status status={installment.status} payment={payments.get(installment.id)} />
              </span>
            </li>
          ))}
        </ul>
        <table className="hidden w-full border-collapse @table:table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${HEAD} text-left`}>
                Parcela
              </th>
              <th scope="col" className={`${HEAD} text-left`}>
                Vencimento
              </th>
              <th scope="col" className={`${HEAD} text-left`}>
                Conta
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Valor
              </th>
              <th scope="col" className={`${HEAD} pl-4 text-left`}>
                Situação
              </th>
              <th scope="col" className={`${HEAD} w-10`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {installments.items.map((installment) => {
              const payment = payments.get(installment.id);
              return (
                <tr key={installment.id}>
                  <td className={`${CELL} pr-4 whitespace-nowrap tabular-nums`}>
                    {numberText(installment.number, entry.installmentCount)}
                  </td>
                  <td className={`${CELL} pr-4 whitespace-nowrap tabular-nums`}>
                    {formatCalendarDate(installment.dueDate)}
                  </td>
                  <td className={`${CELL} pr-4 wrap-anywhere`}>{installment.accountName}</td>
                  <td className={`${CELL} text-right`}>
                    <MoneyValue amount={installment.amount} direction={direction} />
                  </td>
                  <td className={`${CELL} pl-4`}>
                    <Status status={installment.status} payment={payment} />
                  </td>
                  <td className={`${CELL} text-right`}>
                    <InstallmentActions
                      description={entry.description}
                      installment={installment}
                      installmentCount={entry.installmentCount}
                      direction={direction}
                      payment={payment ?? null}
                      accounts={ownAccounts}
                      days={days}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {installments.total > installments.pageSize && (
        <UrlPagination page={installments} label="Paginação das parcelas" param={INSTALLMENTS_PAGE} />
      )}
    </section>
  );
}

/**
 * O detalhe do lançamento: o tipo e a forma, a descrição, os dados e as parcelas, com a página delas no
 * endereço (`?installmentsPage=`), e o menu de cada parcela, com o pagamento. A correção, o cancelamento, a
 * edição e a exclusão entram com o KAN-30.
 */
export default async function EntryDetail({ params, searchParams }: PageProps<'/entries/[id]'>) {
  await connection();
  const { id } = await params;
  const page = requestedPage((await searchParams)[INSTALLMENTS_PAGE]);
  const [entry, installments, payments, accounts] = await Promise.all([
    loadOrNotFound(() => getEntry(id)),
    listInstallments(id, page),
    listInstallmentPayments(id),
    listAccountChoices(),
  ]);
  if (!entry) return <LoadError>Não foi possível carregar o lançamento.</LoadError>;
  if (installments.status === 'unauthenticated' || payments.status === 'unauthenticated') redirect('/login');
  const form = entry.installmentCount > 1 ? 'parcelada' : 'à vista';

  return (
    <section aria-labelledby="entry-title" className={PANEL}>
      <div className="flex flex-col gap-1">
        <span className="text-body-sm text-mute">
          {TYPE_NAMES[entry.type]} {form}
        </span>
        <h2 id="entry-title" className="text-heading-md wrap-anywhere text-ink">
          {entry.description}
        </h2>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Datum term="Valor total">
          <MoneyValue amount={entry.totalAmount} />
        </Datum>
        <Datum term="Categoria">{categoryPath(entry.categoryName, entry.categoryParentName)}</Datum>
        {entry.purpose && <Datum term="Finalidade">{PURPOSE_NAMES[entry.purpose]}</Datum>}
        <Datum term="Entidade">{entry.entityName}</Datum>
        <Datum term={OCCURRED_ON_LABELS[entry.type]}>
          <span className="tabular-nums">{formatCalendarDate(entry.occurredOn)}</span>
        </Datum>
        <Datum term="Parcelas">
          {entry.installmentCount > 1 ? `${String(entry.installmentCount)} parcelas mensais` : 'À vista'}
        </Datum>
      </dl>
      {/* Sem os pagamentos, a parcela liquidada pareceria em aberto no menu: a seção mostra o erro. */}
      {installments.status === 'ok' && payments.status === 'ok' ? (
        <Installments
          entry={entry}
          installments={installments.data}
          payments={new Map(payments.data.map((paid) => [paid.installmentId, paid]))}
          accounts={accounts.status === 'ok' ? accounts.data : []}
        />
      ) : (
        <LoadError>Não foi possível carregar as parcelas.</LoadError>
      )}
    </section>
  );
}
