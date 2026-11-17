import type { EquityStake } from '@/api/equity-stakes';

import { formatCalendarDate } from '../../../_shell/format';
import { INITIAL_FORM_STATE } from '../../../_shell/form-state';

/** O formulário aberto dentro da seção das participações, como no protótipo. */
export const SUBFORM = 'flex flex-col gap-3 rounded-md border border-hairline bg-surface-subtle p-4';

/** Os formulários das participações antes do primeiro envio, ainda não aceitos. */
export const UNSAVED = { ...INITIAL_FORM_STATE, saved: false } as const;

/** O período da participação: "desde 01/03/2022", ou "01/03/2022 a 30/11/2026" na encerrada. */
export function periodText(stake: EquityStake): string {
  const start = formatCalendarDate(stake.startDate);
  return stake.endDate ? `${start} a ${formatCalendarDate(stake.endDate)}` : `desde ${start}`;
}
