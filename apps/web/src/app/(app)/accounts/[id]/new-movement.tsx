'use client';

import { Info, Plus } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import { DateField, ErrorNotice, FieldError, SubmitButton, TextField } from '../../../_access/fields';
import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { FormDialog, FormDialogCancel } from '../../../_shell/form-dialog';
import { UNSAVED_FORM_STATE } from '../../../_shell/form-state';
import { createMovementAction } from '../actions';

/** Uma opção do sentido, como um botão de alternância, marcada em `accent-soft`. */
const DIRECTION_OPTION = `flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-hairline-strong bg-surface text-label text-ink has-checked:border-accent has-checked:bg-accent-soft md:h-9 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;

const DIRECTIONS = [
  { value: 'outflow', label: 'Saída' },
  { value: 'inflow', label: 'Entrada' },
] as const;

/**
 * O formulário da nova movimentação: o sentido, a data, o valor e a descrição, e o aviso da substituição
 * pelo extrato. Ele só existe com o diálogo aberto, então cada abertura começa do zero; depois de uma
 * recusa, os campos voltam ao que foi enviado.
 */
function MovementForm({
  accountId,
  today,
  onSaved,
}: Readonly<{ accountId: string; today: string; onSaved: () => void }>) {
  const [state, action] = useActionState(createMovementAction, UNSAVED_FORM_STATE);
  // O envio aceito fecha o diálogo; o detalhe e a lista já chegam atualizados pela revalidação.
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);
  const values = state.values;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="accountId" value={accountId} />
      <fieldset
        aria-describedby={state.fields.direction ? 'movement-direction-error' : undefined}
        className="flex flex-col gap-1"
      >
        <legend className="mb-1 text-label text-ink">Sentido</legend>
        <div className="flex gap-2">
          {DIRECTIONS.map((direction) => (
            <label key={direction.value} className={DIRECTION_OPTION}>
              <input
                type="radio"
                name="direction"
                value={direction.value}
                defaultChecked={(values?.direction ?? 'outflow') === direction.value}
                className="size-4 accent-ink"
              />
              {direction.label}
            </label>
          ))}
        </div>
        <FieldError id="movement-direction-error" error={state.fields.direction} />
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        <DateField
          id="movement-date"
          name="date"
          label="Data"
          autoComplete="off"
          size="app"
          defaultValue={values?.date ?? today}
          error={state.fields.date}
        />
        <TextField
          id="movement-amount"
          name="amount"
          label="Valor (R$)"
          autoComplete="off"
          size="app"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={values?.amount ?? ''}
          error={state.fields.amount}
        />
      </div>
      <TextField
        id="movement-description"
        name="description"
        label="Descrição"
        autoComplete="off"
        size="app"
        defaultValue={values?.description ?? ''}
        error={state.fields.description}
      />
      <div className="flex items-start gap-3 rounded-md border border-accent-soft bg-accent-soft px-4 py-3 text-ink">
        <Info size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 flex-none text-link" />
        <p>
          Quando o extrato desta conta for importado, a linha do banco com o mesmo valor, sentido e data próxima
          substitui esta movimentação.
        </p>
      </div>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <FormDialogCancel />
        <SubmitButton size="app">Registrar movimentação</SubmitButton>
      </div>
    </form>
  );
}

/**
 * O "Nova movimentação" da seção Movimentações e o diálogo que ele abre (design-system.md, seção 4.5), que
 * no celular vira a folha. `today` é a data que o campo traz de partida.
 */
export function NewMovement({
  accountId,
  accountName,
  today,
}: Readonly<{ accountId: string; accountName: string; today: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={`Nova movimentação em ${accountName}`}
      trigger={
        <button type="button" className={SECONDARY_BUTTON}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Nova movimentação
        </button>
      }
    >
      <MovementForm
        accountId={accountId}
        today={today}
        onSaved={() => {
          setOpen(false);
        }}
      />
    </FormDialog>
  );
}
