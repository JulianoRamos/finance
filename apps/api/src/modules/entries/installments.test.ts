import { describe, expect, it } from 'vitest';

import { Decimal, formatCalendarDate, parseCalendarDate } from '../../common/index.js';
import { installmentStatus, planInstallments, splitAmount } from './installments.js';

/** Os valores como texto com 2 casas, como a rota os devolve. */
function texts(amounts: readonly Decimal[]): string[] {
  return amounts.map((amount) => amount.toFixed(2));
}

/** O dia `AAAA-MM-DD` como a data de calendário. */
function day(text: string): Date {
  const date = parseCalendarDate(text);
  if (!date) throw new Error(`Data inválida no teste: ${text}`);
  return date;
}

describe('splitAmount', () => {
  it('divide o total em centavos, com a diferença na primeira parcela', () => {
    expect(texts(splitAmount(new Decimal('100.00'), 3))).toEqual(['33.34', '33.33', '33.33']);
    expect(texts(splitAmount(new Decimal('1000.00'), 3))).toEqual(['333.34', '333.33', '333.33']);
    expect(texts(splitAmount(new Decimal('0.05'), 3))).toEqual(['0.03', '0.01', '0.01']);
  });

  it('à vista, a parcela única é o total', () => {
    expect(texts(splitAmount(new Decimal('1200.00'), 1))).toEqual(['1200.00']);
  });

  it('a divisão exata deixa as parcelas iguais', () => {
    expect(texts(splitAmount(new Decimal('5399.90'), 10))).toEqual(Array<string>(10).fill('539.99'));
  });
});

/** Os vencimentos das parcelas planejadas de um total qualquer, como `AAAA-MM-DD`. */
function dueDates(first: string, count: number): string[] {
  return planInstallments(new Decimal('100.00'), count, day(first)).map((planned) =>
    formatCalendarDate(planned.dueDate),
  );
}

describe('planInstallments', () => {
  it('cada parcela vence um mês depois da anterior, no mesmo dia', () => {
    expect(dueDates('2026-09-10', 4)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10']);
  });

  it('no mês sem o dia, vence no último dia dele, e volta ao dia no mês que o tem', () => {
    expect(dueDates('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(dueDates('2027-12-30', 3)).toEqual(['2027-12-30', '2028-01-30', '2028-02-29']);
  });
});

/** Uma parcela de R$ 100,00 com o vencimento e a soma conciliada dados. */
function installment(dueDate: string, reconciledAmount = '0.00') {
  return { amount: new Decimal('100.00'), reconciledAmount: new Decimal(reconciledAmount), dueDate: day(dueDate) };
}

describe('installmentStatus', () => {
  it('em aberto, é vencida antes de hoje, e prevista a partir de hoje', () => {
    const today = day('2026-11-15');

    expect(installmentStatus(installment('2026-11-14'), today)).toBe('overdue');
    expect(installmentStatus(installment('2026-11-15'), today)).toBe('expected');
    expect(installmentStatus(installment('2026-12-01'), today)).toBe('expected');
  });

  it('com a soma conciliada igual ao valor, é liquidada, também depois do vencimento', () => {
    const today = day('2026-11-15');

    expect(installmentStatus(installment('2026-11-01', '100.00'), today)).toBe('settled');
    expect(installmentStatus(installment('2026-12-01', '100.00'), today)).toBe('settled');
  });
});
