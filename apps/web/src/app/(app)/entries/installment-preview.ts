// A prévia das parcelas do formulário, calculada na web pela mesma regra da api, só para mostrar: quem
// grava as parcelas é a api (LLD, seção 4.6, e regra 6.21).

import { fromCents, toCents } from '../../_shell/money';

/** Uma parcela da prévia: o número, o vencimento `AAAA-MM-DD` e o valor, em string decimal. */
export interface PreviewInstallment {
  readonly number: number;
  readonly dueDate: string;
  readonly amount: string;
}

/** O maior número de parcelas de um lançamento (LLD, seção 4.6). */
export const MAX_INSTALLMENTS = 120;

/** O vencimento da parcela `number`: `number`−1 meses depois do primeiro, no mesmo dia, ou no último do mês. */
function dueDateOf(first: string, number: number): string {
  const [year = 0, month = 1, day = 1] = first.split('-').map(Number);
  const target = month - 1 + number - 1;
  const lastDay = new Date(Date.UTC(year, target + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, target, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/**
 * As parcelas mensais do total (string decimal positiva) a partir do primeiro vencimento: o total dividido
 * em centavos, com a diferença na primeira. Vazia quando o número não é de 1 a 120 ou passa do total em
 * centavos, que a api recusaria.
 */
export function previewInstallments(total: string, count: number, firstDueDate: string): PreviewInstallment[] {
  const cents = toCents(total);
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS || cents < BigInt(count)) return [];
  const share = cents / BigInt(count);
  const firstShare = cents - share * BigInt(count - 1);
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: dueDateOf(firstDueDate, index + 1),
    amount: fromCents(index === 0 ? firstShare : share),
  }));
}
