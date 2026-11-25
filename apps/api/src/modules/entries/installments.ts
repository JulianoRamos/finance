import { type CalendarMonth, Decimal, formatCalendarDate, type Sql, sql } from '../../common/index.js';

// As regras das parcelas de um lançamento, como funções puras (LLD, seção 4.6, e regras 6.6 e 6.21).

/**
 * O total dividido em `count` parcelas, em centavos: cada uma recebe a parte inteira da divisão, e a
 * diferença fica na primeira (regra 6.21).
 */
export function splitAmount(total: Decimal, count: number): Decimal[] {
  const cents = total.times(100);
  const share = cents.dividedToIntegerBy(count);
  const first = cents.minus(share.times(count - 1));
  return [first, ...Array.from({ length: count - 1 }, () => share)].map((part) => part.dividedBy(100));
}

/**
 * O vencimento da parcela `number`: ela vence `number`−1 meses depois do primeiro vencimento, no mesmo dia,
 * ou no último dia do mês que não tem esse dia (LLD, seção 4.6). As datas são de calendário, a meia-noite
 * UTC do dia.
 */
function dueDateOf(first: Date, number: number): Date {
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + number - 1;
  // O dia 0 do mês seguinte é o último dia do mês.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(first.getUTCDate(), lastDay)));
}

/** Uma parcela planejada: o número, o valor e o vencimento. */
export interface PlannedInstallment {
  readonly number: number;
  readonly amount: Decimal;
  readonly dueDate: Date;
}

/**
 * As parcelas mensais de um lançamento novo: o total dividido em centavos (`splitAmount`), a partir do
 * primeiro vencimento.
 */
export function planInstallments(total: Decimal, count: number, firstDueDate: Date): PlannedInstallment[] {
  return splitAmount(total, count).map((amount, index) => ({
    number: index + 1,
    amount,
    dueDate: dueDateOf(firstDueDate, index + 1),
  }));
}

/** A situação da parcela, calculada na leitura (regra 6.6). A liquidada e a cancelada entram depois. */
export const InstallmentStatus = { expected: 'expected', overdue: 'overdue' } as const;
export type InstallmentStatus = (typeof InstallmentStatus)[keyof typeof InstallmentStatus];

/** Vencida quando o vencimento é anterior a hoje, e prevista a partir de hoje (regra 6.6). */
export function installmentStatus(dueDate: Date, today: Date): InstallmentStatus {
  return dueDate < today ? 'overdue' : 'expected';
}

/** A condição da parcela, pela coluna do vencimento dada, que vence no mês. */
export function dueInMonth(dueDate: Sql, month: CalendarMonth): Sql {
  return sql`${dueDate} >= ${formatCalendarDate(month.start)}::date AND ${dueDate} < ${formatCalendarDate(month.next)}::date`;
}
