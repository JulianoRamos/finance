'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createEntry, listEntries } from '@/api/entries';
import { createPaidEntry, payInstallment, undoInstallmentPayment } from '@/api/installment-payments';
import { currentFinancialContext } from '@/api/financial-context';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import {
  fieldRefusal,
  type FormState,
  refusedFormState,
  SAVED_FORM_STATE,
  type SavableFormState,
} from '../../_shell/form-state';
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
  /** O "Já pago": o lançamento nasce com a primeira parcela paga, na conta e na data do pagamento. */
  readonly paid: boolean;
  readonly paymentAccountId: string;
  readonly paymentDate: string;
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
  'paymentAccountId',
  'paymentDate',
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
  INVALID_PAYMENT_ACCOUNT: 'paymentAccountId',
  INACTIVE_PAYMENT_ACCOUNT: 'paymentAccountId',
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
    paid: form.get('paid') === 'on',
    paymentAccountId: formText(form, 'paymentAccountId'),
    paymentDate: formText(form, 'paymentDate'),
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
  if (values.paid && !values.paymentAccountId) fields.paymentAccountId = 'Escolha a conta do pagamento.';
  if (values.type === 'expense' && values.purpose === null) fields.purpose = 'Escolha a finalidade da despesa.';
  if (totalAmount === null) fields.totalAmount = 'Informe o valor total, como 1.234,56.';
  if (!Number.isInteger(count))
    fields.installmentCount = `Informe o número de parcelas, de 1 a ${String(MAX_INSTALLMENTS)}.`;
  if (Object.keys(fields).length > 0 || totalAmount === null) {
    return { values, message: null, conflict: false, fields };
  }
  const entry = {
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
  };
  const result = values.paid
    ? await createPaidEntry({ ...entry, paymentAccountId: values.paymentAccountId, paymentDate: values.paymentDate })
    : await createEntry(entry);
  if (result.ok) {
    revalidatePath('/entries', 'layout');
    // O pagamento muda o saldo da conta, que a tela Contas mostra.
    if (values.paid) revalidatePath('/accounts', 'layout');
    redirect(`/entries/${result.data.id}`);
  }
  return refusedFormState(result, values, SHOWN_FIELDS, FIELD_OF_CODE);
}

/** O que foi enviado no diálogo de pagar uma parcela, que volta aos campos depois de uma recusa. */
export interface PaymentFormValues {
  readonly accountId: string;
  readonly date: string;
}

/** O que o diálogo de pagar uma parcela mostra depois de um envio, recusado ou aceito. */
export type PaymentFormState = SavableFormState<PaymentFormValues>;

/** Os campos que o diálogo do pagamento mostra com o erro ao lado. */
const PAYMENT_FIELDS: ReadonlySet<string> = new Set(['accountId', 'date']);

/** As recusas de regra do pagamento que são da conta, ligadas ao campo dela. */
const PAYMENT_FIELD_OF_CODE: Readonly<Record<string, string>> = {
  INVALID_ACCOUNT: 'accountId',
  INACTIVE_ACCOUNT: 'accountId',
};

/**
 * Paga a parcela do diálogo, na conta e na data dele, e lê de novo o detalhe, a lista e o saldo das
 * contas; a recusa volta ao diálogo.
 */
export async function payInstallmentAction(_previous: PaymentFormState, form: FormData): Promise<PaymentFormState> {
  const values = { accountId: formText(form, 'accountId'), date: formText(form, 'date') };
  if (!values.accountId) return fieldRefusal(values, 'accountId', 'Escolha a conta do pagamento.');
  const result = await payInstallment({ installmentId: formText(form, 'installmentId'), ...values });
  if (!result.ok) return { ...refusedFormState(result, values, PAYMENT_FIELDS, PAYMENT_FIELD_OF_CODE), saved: false };
  revalidatePath('/entries', 'layout');
  revalidatePath('/accounts', 'layout');
  return SAVED_FORM_STATE;
}

/** Desfaz o pagamento dado e lê de novo o detalhe, a lista e o saldo das contas; a recusa volta à tela. */
export async function undoPaymentAction(_previous: CommandMessage, { id }: { id: string }): Promise<CommandMessage> {
  const result = await undoInstallmentPayment(id);
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  revalidatePath('/entries', 'layout');
  revalidatePath('/accounts', 'layout');
  return { message: result.ok ? null : result.message };
}
