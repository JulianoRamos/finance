'use client';

import { CircleCheck, Ellipsis, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import { useActionState, useEffect, useState } from 'react';

import { ControlField, DateField, describedBy, ErrorNotice, inputClass, SubmitButton } from '../../../_access/fields';
import { GHOST_ICON_BUTTON } from '../../../_shell/buttons';
import { ConfirmDialog, useConfirmedCommand } from '../../../_shell/confirm-dialog';
import { formatCalendarDate } from '../../../_shell/format';
import { FormDialog, FormDialogCancel } from '../../../_shell/form-dialog';
import { UNSAVED_FORM_STATE } from '../../../_shell/form-state';
import { Hint } from '../../../_shell/hint';
import { MENU_ITEM, MENU_ITEM_DESTRUCTIVE, MENU_LABEL, MENU_PANEL, MENU_SEPARATOR } from '../../../_shell/menu';
import { formatMoney } from '../../../_shell/money';
import { payInstallmentAction, undoPaymentAction } from '../actions';
import { DateShortcuts, type ShortcutDays } from '../date-shortcuts';
import { type InstallmentStatus, numberText } from '../entry-text';

/** Uma conta que o pagamento pode usar: as ativas da entidade dona do lançamento. */
export interface PaymentAccount {
  readonly id: string;
  readonly name: string;
}

/** A parcela como o menu a conhece. */
export interface MenuInstallment {
  readonly id: string;
  readonly number: number;
  readonly amount: string;
  readonly dueDate: string;
  readonly accountId: string;
  readonly status: InstallmentStatus;
}

/** O pagamento de uma parcela liquidada: o id, que o desfazer usa, a conta e o dia. */
export interface MenuPayment {
  readonly id: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly date: string;
}

/** A frase do diálogo de pagar: o lançamento, o valor e o vencimento, vencido ou não. */
function paymentSummary(description: string, installment: MenuInstallment): string {
  const due = formatCalendarDate(installment.dueDate);
  const when = installment.status === 'overdue' ? `vencida desde ${due}` : `vence em ${due}`;
  return `${description} · ${formatMoney(installment.amount)} · ${when}`;
}

/**
 * O formulário de pagar a parcela: a conta, começando pela da parcela, e a data, começando por hoje, com
 * os atalhos. Ele só existe com o diálogo aberto, então cada abertura começa do zero.
 */
function PaymentForm({
  installment,
  direction,
  accounts,
  days,
  onSaved,
}: Readonly<{
  installment: MenuInstallment;
  direction: 'inflow' | 'outflow';
  accounts: readonly PaymentAccount[];
  days: ShortcutDays;
  onSaved: () => void;
}>) {
  const [state, action] = useActionState(payInstallmentAction, UNSAVED_FORM_STATE);
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);
  // A conta da parcela é a de partida quando ainda é uma escolha: ativa e da entidade dona.
  const [accountId, setAccountId] = useState(
    accounts.some((account) => account.id === installment.accountId) ? installment.accountId : '',
  );
  const [date, setDate] = useState(days.today);
  const account = accounts.find((option) => option.id === accountId);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="installmentId" value={installment.id} />
      <div className="grid gap-3 md:grid-cols-2">
        <ControlField id="payment-account" label="Conta do pagamento" error={state.fields.accountId}>
          <select
            id="payment-account"
            name="accountId"
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
            }}
            className={inputClass('app')}
            {...describedBy('payment-account', state.fields.accountId)}
          >
            <option value="">Selecione</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </ControlField>
        <DateField
          id="payment-date"
          name="date"
          label="Data do pagamento"
          autoComplete="off"
          size="app"
          value={date}
          onValueChange={setDate}
          error={state.fields.date}
          after={<DateShortcuts days={days} onPick={setDate} />}
        />
      </div>
      <p>
        O pagamento vira uma {direction === 'inflow' ? 'entrada' : 'saída'} de {formatMoney(installment.amount)}{' '}
        {account ? `em ${account.name}` : 'na conta escolhida'} nessa data, ligada à parcela, que fica liquidada. Quando
        o extrato chegar, a linha do banco substitui essa movimentação.
      </p>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <FormDialogCancel />
        <SubmitButton size="app">Marcar como paga</SubmitButton>
      </div>
    </form>
  );
}

/**
 * O menu de ações de uma parcela, na tabela das parcelas (design-system.md, seção 4.4): na em aberto, o
 * "Marcar como paga", que abre o diálogo do pagamento; na liquidada, o "Ver o pagamento", que abre a
 * conta, e o "Desfazer pagamento", com a confirmação. A correção e o cancelamento entram com o KAN-30.
 */
export function InstallmentActions({
  description,
  installment,
  installmentCount,
  direction,
  payment,
  accounts,
  days,
}: Readonly<{
  description: string;
  installment: MenuInstallment;
  installmentCount: number;
  direction: 'inflow' | 'outflow';
  payment: MenuPayment | null;
  accounts: readonly PaymentAccount[];
  days: ShortcutDays;
}>) {
  const [paying, setPaying] = useState(false);
  const undo = useConfirmedCommand(undoPaymentAction, { id: payment?.id ?? '' });
  const label = `Ações da parcela ${String(installment.number)}`;
  const position = `Parcela ${numberText(installment.number, installmentCount)}`;

  return (
    <>
      {undo.message && <ErrorNotice>{undo.message}</ErrorNotice>}
      <DropdownMenu.Root modal={false}>
        <Hint label={label} expanded={false} side="bottom">
          <DropdownMenu.Trigger
            aria-label={label}
            disabled={undo.pending}
            className={`inline-flex size-7 ${GHOST_ICON_BUTTON} aria-expanded:bg-surface-subtle`}
          >
            <Ellipsis size={16} strokeWidth={1.5} aria-hidden="true" />
          </DropdownMenu.Trigger>
        </Hint>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} className={MENU_PANEL}>
            {payment ? (
              <>
                <DropdownMenu.Label className={MENU_LABEL}>{position} · paga</DropdownMenu.Label>
                <DropdownMenu.Item asChild className={MENU_ITEM}>
                  <Link href={`/accounts/${payment.accountId}`}>
                    <Wallet size={16} strokeWidth={1.5} aria-hidden="true" />
                    Ver o pagamento no {payment.accountName}
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={MENU_SEPARATOR} />
                <DropdownMenu.Item
                  className={MENU_ITEM_DESTRUCTIVE}
                  onSelect={() => {
                    undo.setConfirming(true);
                  }}
                >
                  <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  Desfazer pagamento
                </DropdownMenu.Item>
                <p className="max-w-menu px-2 pt-1 pb-2 text-body-sm text-mute">
                  Apaga a movimentação manual de {formatCalendarDate(payment.date)} na conta, e a parcela volta a ficar
                  em aberto.
                </p>
              </>
            ) : (
              <>
                <DropdownMenu.Label className={MENU_LABEL}>{position}</DropdownMenu.Label>
                <DropdownMenu.Item
                  className={MENU_ITEM}
                  onSelect={() => {
                    setPaying(true);
                  }}
                >
                  <CircleCheck size={16} strokeWidth={1.5} aria-hidden="true" />
                  Marcar como paga
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <FormDialog
        open={paying}
        onOpenChange={setPaying}
        title={`Marcar a parcela ${String(installment.number)} como paga`}
        description={paymentSummary(description, installment)}
      >
        <PaymentForm
          installment={installment}
          direction={direction}
          accounts={accounts}
          days={days}
          onSaved={() => {
            setPaying(false);
          }}
        />
      </FormDialog>
      {payment && (
        <ConfirmDialog
          open={undo.confirming}
          onOpenChange={undo.setConfirming}
          title={`Desfazer o pagamento da parcela ${String(installment.number)}?`}
          description={`A ${direction === 'inflow' ? 'entrada' : 'saída'} de ${formatMoney(installment.amount)} de ${formatCalendarDate(payment.date)} sai do ${payment.accountName}, e o saldo da conta volta ao de antes. A parcela volta a ficar em aberto.`}
          confirmLabel="Desfazer pagamento"
          onConfirm={undo.run}
        />
      )}
    </>
  );
}
