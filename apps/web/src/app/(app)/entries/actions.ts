'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createEntry, listEntries } from '@/api/entries';
import { currentFinancialContext } from '@/api/financial-context';

import { formText } from '../../_access/form-text';
import { type FormState, refusedFormState } from '../../_shell/form-state';
import { listPageResult, type ListPageResult } from '../../_shell/list-page';
import { parseMoneyInput } from '../../_shell/money';
import { type EntryListItem, entryListItem } from './entry-list-page';
import { MAX_INSTALLMENTS } from './installment-preview';
import type { EntryParams, EntryPurpose, EntryType } from './entry-text';

/** O que foi enviado no formulário do lançamento, que volta aos campos depois de uma recusa. */
export interface EntryFormValues {
  readonly type: EntryType;
  readonly entityId: string;
  readonly description: string;
  readonly totalAmount: string;
  readonly occurredOn: string;
  readonly categoryId: string;
  readonly purpose: EntryPurpose | null;
  readonly installments: boolean;
  readonly installmentCount: string;
  readonly firstDueDate: string;
  readonly accountId: string;
}

/** O que o formulário do lançamento mostra depois de um envio recusado. */
export type EntryFormState = FormState<EntryFormValues>;

/** Os campos que o formulário mostra com o erro ao lado; a recusa de outro campo vai para o aviso. */
const SHOWN_FIELDS: ReadonlySet<string> = new Set([
  'type',
  'entityId',
  'description',
  'totalAmount',
  'occurredOn',
  'categoryId',
  'purpose',
  'installmentCount',
  'firstDueDate',
  'accountId',
]);

/**
 * As recusas de regra que são de um campo, e o campo delas. O corpo de erro só traz `fields` na entrada
 * inválida (LLD, seção 5), então a web liga o código ao campo.
 */
const FIELD_OF_CODE: Readonly<Record<string, string>> = {
  FORBIDDEN: 'entityId',
  ENTITY_NOT_INDIVIDUAL: 'entityId',
  INACTIVE_ENTITY: 'entityId',
  INVALID_CATEGORY: 'categoryId',
  CATEGORY_NATURE_MISMATCH: 'categoryId',
  INACTIVE_CATEGORY: 'categoryId',
  INVALID_ACCOUNT: 'accountId',
  INACTIVE_ACCOUNT: 'accountId',
};

/** Uma página da lista do mês, pedida pela Coluna, já como a tela a mostra. */
export async function listEntriesAction(params: EntryParams): Promise<ListPageResult<EntryListItem>> {
  const [list, context] = await Promise.all([listEntries(params), currentFinancialContext()]);
  const individuals =
    context.status === 'ok' ? context.context.entities.filter((entity) => entity.type === 'individual').length : 0;
  return listPageResult(list, (item) => entryListItem(item, individuals > 1));
}

/** O que foi enviado no formulário. */
function valuesOf(form: FormData): EntryFormValues {
  const purpose = formText(form, 'purpose');
  return {
    type: formText(form, 'type') === 'revenue' ? 'revenue' : 'expense',
    entityId: formText(form, 'entityId'),
    description: formText(form, 'description'),
    totalAmount: formText(form, 'totalAmount'),
    occurredOn: formText(form, 'occurredOn'),
    categoryId: formText(form, 'categoryId'),
    purpose: purpose === 'personal' || purpose === 'household' ? purpose : null,
    installments: formText(form, 'payment') === 'installments',
    installmentCount: formText(form, 'installmentCount'),
    firstDueDate: formText(form, 'firstDueDate'),
    accountId: formText(form, 'accountId'),
  };
}

/**
 * Registra o lançamento do formulário e abre o detalhe dele, com a lista lida de novo, ou devolve a
 * recusa: as escolhas e o valor digitado a web confere antes, e o resto a api.
 */
export async function createEntryAction(_previous: EntryFormState, form: FormData): Promise<EntryFormState> {
  const values = valuesOf(form);
  const totalAmount = parseMoneyInput(values.totalAmount);
  const count = values.installments ? Number(values.installmentCount) : 1;
  const fields: Record<string, string> = {};
  if (!values.entityId) fields.entityId = 'Escolha a pessoa física.';
  if (!values.categoryId) fields.categoryId = 'Escolha a categoria.';
  if (!values.accountId) fields.accountId = 'Escolha a conta.';
  if (values.type === 'expense' && values.purpose === null) fields.purpose = 'Escolha a finalidade da despesa.';
  if (totalAmount === null) fields.totalAmount = 'Informe o valor total, como 1.234,56.';
  if (!Number.isInteger(count))
    fields.installmentCount = `Informe o número de parcelas, de 1 a ${String(MAX_INSTALLMENTS)}.`;
  if (Object.keys(fields).length > 0 || totalAmount === null) {
    return { values, message: null, conflict: false, fields };
  }
  const result = await createEntry({
    entityId: values.entityId,
    type: values.type,
    description: values.description,
    categoryId: values.categoryId,
    ...(values.type === 'expense' && values.purpose !== null && { purpose: values.purpose }),
    occurredOn: values.occurredOn,
    totalAmount,
    installmentCount: count,
    firstDueDate: values.firstDueDate,
    accountId: values.accountId,
  });
  if (result.ok) {
    revalidatePath('/entries', 'layout');
    redirect(`/entries/${result.data.id}`);
  }
  return refusedFormState(result, values, SHOWN_FIELDS, FIELD_OF_CODE);
}
