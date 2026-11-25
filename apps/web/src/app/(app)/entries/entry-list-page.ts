import type { EntryMonthItem } from '@/api/entries';

import { categoryPath } from '../../_shell/category-text';
import { type EntryType, type InstallmentStatus, PURPOSE_NAMES } from './entry-text';

/** Uma parcela do mês como a lista a mostra, já formatada. */
export interface EntryListItem {
  /** O id da parcela, que identifica o item na página. */
  readonly id: string;
  readonly entryId: string;
  readonly description: string;
  /**
   * A segunda linha: a entidade, num contexto com mais de uma pessoa física, a categoria com o pai, a
   * finalidade, a parcela, no parcelado, e o dia do vencimento, como "Educação · Pessoal · parcela 3 de 10
   * · 10/11".
   */
  readonly meta: string;
  readonly type: EntryType;
  /** O valor da parcela, a string decimal da api. */
  readonly amount: string;
  readonly status: InstallmentStatus;
}

/** O dia e o mês de uma data `AAAA-MM-DD`, como "10/11". */
function dayAndMonth(date: string): string {
  const [, month = '', day = ''] = date.split('-');
  return `${day}/${month}`;
}

/** A parcela do mês como a lista a mostra (design-system.md, seção 4.1), com o valor e a situação à direita. */
export function entryListItem(item: EntryMonthItem, showEntity: boolean): EntryListItem {
  const parts = [
    ...(showEntity ? [item.entityName] : []),
    categoryPath(item.categoryName, item.categoryParentName),
    ...(item.purpose ? [PURPOSE_NAMES[item.purpose]] : []),
    ...(item.installmentCount > 1 ? [`parcela ${String(item.number)} de ${String(item.installmentCount)}`] : []),
    dayAndMonth(item.dueDate),
  ];
  return {
    id: item.installmentId,
    entryId: item.entryId,
    description: item.description,
    meta: parts.join(' · '),
    type: item.type,
    amount: item.amount,
    status: item.status,
  };
}
