'use client';

import { useActionState, useEffect } from 'react';

import type { EquityStake } from '@/api/equity-stakes';

import { DateField, ErrorNotice, SubmitButton } from '../../../_access/fields';
import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { formatFraction } from '../../../_shell/format';
import { type EndEquityStakeFormState, endEquityStakeAction } from '../actions';
import { periodText, SUBFORM, UNSAVED } from './equity-stake-view';

/** O formulário de encerrar uma participação sem fim com o último dia, dentro da seção, como no protótipo. */
export function EndEquityStakeForm({
  companyId,
  stake,
  onClose,
}: Readonly<{ companyId: string; stake: EquityStake; onClose: () => void }>) {
  const [state, action] = useActionState<EndEquityStakeFormState, FormData>(endEquityStakeAction, UNSAVED);
  // O envio aceito fecha o formulário; a tabela já chega atualizada pela revalidação.
  useEffect(() => {
    if (state.saved) onClose();
  }, [state.saved, onClose]);
  const titleId = 'end-equity-stake-title';
  return (
    <form action={action} aria-labelledby={titleId} className={SUBFORM}>
      <span id={titleId} className="text-label text-ink">
        Encerrar a participação de {stake.holder.name} ({formatFraction(stake.fraction)}, {periodText(stake)})
      </span>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="stakeId" value={stake.id} />
      <input type="hidden" name="version" value={stake.version} />
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="max-w-form">
        <DateField
          id="end-equity-stake-date"
          name="endDate"
          label="Último dia"
          autoComplete="off"
          size="app"
          defaultValue={state.values?.endDate ?? ''}
          error={state.fields.endDate}
          help="Depois desse dia, a fração deixa de contar como vigente e libera espaço para outra participação. O registro continua no histórico."
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Cancelar
        </button>
        <SubmitButton size="app">Encerrar participação</SubmitButton>
      </div>
    </form>
  );
}
