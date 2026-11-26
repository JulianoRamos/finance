// Os textos e o endereço da tela Lançamentos, que o servidor e o cliente usam (LLD, seção 4.6).

import type { EntryListQuery, EntryPurpose, EntryType, InstallmentStatus } from '@/api/entries';

import { requestedPage } from '../../_shell/list-page';
import { firstParam } from '../../_shell/search-params';

export type { EntryPurpose, EntryType, InstallmentStatus };

/** O nome de cada tipo, como a tela o escreve. */
export const TYPE_NAMES: Readonly<Record<EntryType, string>> = { expense: 'Despesa', revenue: 'Receita' };

/** O rótulo da data do fato de cada tipo, no formulário e no detalhe. */
export const OCCURRED_ON_LABELS: Readonly<Record<EntryType, string>> = {
  expense: 'Data da compra',
  revenue: 'Data da receita',
};

/** O rótulo do vencimento no formulário: na receita, o recebimento; no parcelado, o da primeira parcela. */
export function dueDateLabel(type: EntryType, installments: boolean): string {
  if (type === 'revenue') return installments ? 'Primeiro recebimento' : 'Recebimento';
  return installments ? 'Primeiro vencimento' : 'Vencimento';
}

/** O nome de cada finalidade, como a tela a escreve. */
export const PURPOSE_NAMES: Readonly<Record<EntryPurpose, string>> = { personal: 'Pessoal', household: 'Familiar' };

/** O nome de cada situação, como o selo a escreve. */
export const STATUS_NAMES: Readonly<Record<InstallmentStatus, string>> = {
  expected: 'Prevista',
  overdue: 'Vencida',
  settled: 'Liquidada',
};

/** O estado da lista do mês, que fica no endereço: o filtro da lista da api. */
export type EntryParams = EntryListQuery;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * O estado da lista lido do endereço (`entriesQuery` escreve o mesmo): o mês dado, `AAAA-MM`, todos os
 * tipos, sem busca e na primeira página, no que faltar.
 */
export function entryParams(
  read: (key: string) => string | string[] | null | undefined,
  currentMonth: string,
): EntryParams {
  const month = firstParam(read('month'));
  const type = firstParam(read('type'));
  return {
    month: month !== undefined && MONTH.test(month) ? month : currentMonth,
    type: type === 'expense' || type === 'revenue' ? type : null,
    q: firstParam(read('q')) ?? '',
    page: requestedPage(firstParam(read('page'))),
  };
}

/** O texto do endereço do estado dado, só com o que não é o de partida, com o `?`, ou vazio. */
export function entriesQuery(params: EntryParams, currentMonth: string): string {
  const query = new URLSearchParams();
  if (params.month !== currentMonth) query.set('month', params.month);
  if (params.type !== null) query.set('type', params.type);
  if (params.q !== '') query.set('q', params.q);
  if (params.page > 1) query.set('page', String(params.page));
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** O número da parcela entre todas: "3 de 10". */
export function numberText(number: number, count: number): string {
  return `${String(number)} de ${String(count)}`;
}
