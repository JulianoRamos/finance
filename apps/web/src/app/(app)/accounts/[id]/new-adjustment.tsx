'use client';

import { useActionState, useEffect, useState } from 'react';

import { DateField, ErrorNotice, SubmitButton, TextAreaField, TextField } from '../../../_access/fields';
import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { FormDialog, FormDialogCancel } from '../../../_shell/form-dialog';
import { UNSAVED_FORM_STATE } from '../../../_shell/form-state';
import { formatCalendarDate, FULL_YEAR_DATE } from '../../../_shell/format';
import { directedDifference, formatDirectedMoney, formatMoney, parseMoneyInput } from '../../../_shell/money';
import { SEARCH_DELAY_MS } from '../../../_shell/pagination';
import { accountBalanceAction, createAdjustmentAction } from '../actions';
import { BALANCE_UNAVAILABLE, type BalanceOnDate } from './balance-on-date';

const SUMMARY_ROW = 'flex items-baseline justify-between gap-4';
const SUMMARY_TOTAL = `${SUMMARY_ROW} border-t border-hairline pt-2 font-medium text-ink`;

/** O saldo calculado de uma data, como o diálogo o guarda. */
export interface DatedBalance {
  readonly date: string;
  readonly result: BalanceOnDate;
}

/**
 * O saldo calculado na data, pedido à api pelo servidor a cada data escolhida, depois de a digitação
 * parar; enquanto ele não chega, nulo. `initial` é o que a página já leu, que dispensa o pedido. A
 * resposta de uma data que já mudou fica guardada com a data dela, e não aparece.
 */
function useBalanceOn(accountId: string, date: string, initial: DatedBalance | null): BalanceOnDate | null {
  // O que a página leu vale de partida, salvo uma falha passageira, que é pedida de novo.
  const [balance, setBalance] = useState(initial && (initial.result.ok || !initial.result.retry) ? initial : null);
  const known = balance?.date === date;
  useEffect(() => {
    if (known || !FULL_YEAR_DATE.test(date)) return;
    const timer = setTimeout(() => {
      void accountBalanceAction({ id: accountId, date })
        .catch(() => BALANCE_UNAVAILABLE)
        .then((result) => {
          setBalance({ date, result });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [accountId, date, known]);
  return known ? balance.result : null;
}

/**
 * O resumo do ajuste: o saldo calculado na data, o informado pelo banco e a diferença, com o sentido. A
 * diferença é só para a pessoa conferir: a que vale é a que a api calcula ao registrar.
 */
function AdjustmentSummary({
  date,
  calculated,
  bankBalance,
}: Readonly<{ date: string; calculated: BalanceOnDate | null; bankBalance: string | null }>) {
  let adjustment = '—';
  if (calculated?.ok && bankBalance !== null) {
    const difference = directedDifference(bankBalance, calculated.balance);
    adjustment = difference
      ? formatDirectedMoney(difference.amount, difference.direction)
      : 'Nenhum: os saldos já batem';
  }
  let calculatedText = FULL_YEAR_DATE.test(date) ? 'Calculando…' : 'Escolha a data.';
  if (calculated) calculatedText = calculated.ok ? formatMoney(calculated.balance) : calculated.message;

  return (
    <dl className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-subtle px-4 py-3 tabular-nums">
      <div className={SUMMARY_ROW}>
        <dt>{FULL_YEAR_DATE.test(date) ? `Saldo calculado em ${formatCalendarDate(date)}` : 'Saldo calculado'}</dt>
        <dd className="text-right text-ink">{calculatedText}</dd>
      </div>
      <div className={SUMMARY_ROW}>
        <dt>Saldo informado pelo banco</dt>
        <dd className="text-right text-ink">{bankBalance === null ? '—' : formatMoney(bankBalance)}</dd>
      </div>
      <div className={SUMMARY_TOTAL}>
        <dt>Ajuste</dt>
        <dd className="text-right font-semibold">{adjustment}</dd>
      </div>
    </dl>
  );
}

/**
 * O formulário do ajuste: a data, o saldo do banco, o resumo e o motivo. Ele só existe com o diálogo
 * aberto, então cada abertura começa do zero. A data e o saldo são estado do formulário, e ficam depois
 * de uma recusa; o motivo volta ao que foi enviado.
 */
function AdjustmentForm({
  accountId,
  initialBalance,
  onSaved,
}: Readonly<{ accountId: string; initialBalance: DatedBalance; onSaved: () => void }>) {
  const [state, action] = useActionState(createAdjustmentAction, UNSAVED_FORM_STATE);
  // O envio aceito fecha o diálogo; o detalhe e a lista já chegam atualizados pela revalidação.
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);
  const [date, setDate] = useState(initialBalance.date);
  const [bankBalance, setBankBalance] = useState('');
  const calculated = useBalanceOn(accountId, date, initialBalance);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid gap-3 md:grid-cols-2">
        <DateField
          id="adjustment-date"
          name="date"
          label="Data"
          autoComplete="off"
          size="app"
          value={date}
          onValueChange={setDate}
          error={state.fields.date}
        />
        <TextField
          id="adjustment-bank-balance"
          name="bankBalance"
          label="Saldo no banco (R$)"
          autoComplete="off"
          size="app"
          inputMode="decimal"
          placeholder="0,00"
          value={bankBalance}
          onValueChange={setBankBalance}
          error={state.fields.bankBalance}
        />
      </div>
      <AdjustmentSummary date={date} calculated={calculated} bankBalance={parseMoneyInput(bankBalance)} />
      <TextAreaField
        id="adjustment-reason"
        name="reason"
        label="Motivo"
        autoComplete="off"
        size="app"
        rows={3}
        required={false}
        defaultValue={state.values?.reason ?? ''}
        error={state.fields.reason}
      />
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <FormDialogCancel />
        <SubmitButton size="app">Registrar ajuste</SubmitButton>
      </div>
    </form>
  );
}

/**
 * O "Ajustar saldo" da seção Movimentações e o diálogo que ele abre (design-system.md, seção 4.5), que no
 * celular vira a folha. `balanceOn` é o "Saldo em" da página: a data, que o campo traz de partida, e o
 * saldo dela, que o resumo mostra sem pedir de novo.
 */
export function NewAdjustment({
  accountId,
  accountName,
  balanceOn,
}: Readonly<{ accountId: string; accountName: string; balanceOn: DatedBalance }>) {
  const [open, setOpen] = useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Ajustar o saldo de ${accountName}`}
      description="Registra a diferença entre o saldo calculado e o do banco. O ajuste não é receita nem despesa e aparece no relatório de ajustes."
      trigger={
        <button type="button" className={SECONDARY_BUTTON}>
          Ajustar saldo
        </button>
      }
    >
      <AdjustmentForm
        accountId={accountId}
        initialBalance={balanceOn}
        onSaved={() => {
          setOpen(false);
        }}
      />
    </FormDialog>
  );
}
