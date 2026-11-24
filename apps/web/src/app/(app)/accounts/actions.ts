'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  type AccountResult,
  type AccountType,
  createAccount,
  createAdjustment,
  createMovement,
  getAccountBalance,
  getAccountHistory,
  type Institution,
  listAccounts,
  type MovementDirection,
  setAccountActive,
  updateAccount,
} from '@/api/accounts';

import { formText } from '../../_access/form-text';
import { ACCOUNT_TYPE_NAMES, INSTITUTION_NAMES } from '../../_shell/account-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import {
  fieldRefusal,
  type FormState,
  refusedFormState,
  SAVED_FORM_STATE,
  type SavableFormState,
  UNSAVED_FORM_STATE,
} from '../../_shell/form-state';
import type { HistoryItem } from '../../_shell/history-panel';
import { listPageResult, type ListPageResult } from '../../_shell/list-page';
import { parseMoneyInput } from '../../_shell/money';
import { type BalanceOnDate, balanceOnDate } from './[id]/balance-on-date';
import { accountHistoryItem } from './[id]/history-entry';
import { type AccountListItem, accountListItem } from './account-list-page';

/** O que foi enviado no formulário de uma conta, que volta aos campos depois de uma recusa. */
export interface AccountFormValues {
  readonly entityId: string;
  readonly name: string;
  readonly type: AccountType | null;
  readonly institution: Institution;
  readonly isReserve: boolean;
  readonly openingBalance: string;
  readonly openingBalanceDate: string;
}

/** O que o formulário de uma conta mostra depois de um envio recusado. */
export type AccountFormState = FormState<AccountFormValues>;

/**
 * Os campos que cada formulário mostra com o erro ao lado; a recusa de outro campo vai para o aviso. Na
 * edição, a entidade dona é só um texto, porque não muda.
 */
const EDIT_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'type',
  'institution',
  'openingBalance',
  'openingBalanceDate',
]);
const CREATE_FIELDS: ReadonlySet<string> = new Set([...EDIT_FIELDS, 'entityId']);

/**
 * As recusas de regra que são de um campo, e o campo delas. O corpo de erro só traz `fields` na entrada
 * inválida (LLD, seção 5), então a web liga o código ao campo.
 */
const FIELD_OF_CODE: Readonly<Record<string, string>> = { INACTIVE_ENTITY: 'entityId', FORBIDDEN: 'entityId' };

/** O valor do formulário, se é um dos dados. */
function oneOf<T extends string>(value: string, options: Readonly<Record<T, string>>): T | null {
  return Object.hasOwn(options, value) ? (value as T) : null;
}

/** O que foi enviado no formulário. */
function valuesOf(form: FormData): AccountFormValues {
  return {
    entityId: formText(form, 'entityId'),
    name: formText(form, 'name'),
    type: oneOf(formText(form, 'type'), ACCOUNT_TYPE_NAMES),
    institution: oneOf(formText(form, 'institution'), INSTITUTION_NAMES) ?? 'nubank',
    isReserve: form.get('isReserve') === 'on',
    openingBalance: formText(form, 'openingBalance'),
    openingBalanceDate: formText(form, 'openingBalanceDate'),
  };
}

/**
 * Os dados da conta como a api os recebe, ou as recusas dos campos que a web confere antes: a escolha da
 * entidade e do tipo, e o saldo digitado, que a api recebe como string decimal.
 */
function bodyOf(values: AccountFormValues) {
  const openingBalance = parseMoneyInput(values.openingBalance);
  const fields: Record<string, string> = {};
  if (!values.entityId) fields.entityId = 'Escolha a entidade dona da conta.';
  if (!values.type) fields.type = 'Escolha o tipo da conta.';
  if (openingBalance === null) fields.openingBalance = 'Informe o saldo inicial, como 1.234,56.';
  if (!values.entityId || !values.type || openingBalance === null) return { ok: false, fields } as const;
  return {
    ok: true,
    body: {
      entityId: values.entityId,
      name: values.name,
      type: values.type,
      institution: values.institution,
      isReserve: values.isReserve,
      openingBalance,
      openingBalanceDate: values.openingBalanceDate,
    },
  } as const;
}

/** A recusa dos campos que a web confere antes, sem pedir à api. */
function fieldsRefused(values: AccountFormValues, fields: Readonly<Record<string, string>>): AccountFormState {
  return { values, message: null, conflict: false, fields };
}

/**
 * Mostra a conta que o comando deixou, com a lista lida de novo, ou devolve a recusa para o formulário: a
 * de um campo que ele mostra vai para o campo, e as outras para o aviso.
 */
function afterSave(result: AccountResult, values: AccountFormValues, shown: ReadonlySet<string>): AccountFormState {
  if (result.ok) {
    revalidatePath('/accounts', 'layout');
    redirect(`/accounts/${result.data.id}`);
  }
  return refusedFormState(result, values, shown, FIELD_OF_CODE);
}

/** Cadastra a conta do formulário e abre o detalhe dela. */
export async function createAccountAction(_previous: AccountFormState, form: FormData): Promise<AccountFormState> {
  const values = valuesOf(form);
  const checked = bodyOf(values);
  if (!checked.ok) return fieldsRefused(values, checked.fields);
  return afterSave(await createAccount(checked.body), values, CREATE_FIELDS);
}

/** Salva os dados da conta do formulário, com a versão lida, e volta ao detalhe. */
export async function updateAccountAction(_previous: AccountFormState, form: FormData): Promise<AccountFormState> {
  const values = valuesOf(form);
  const checked = bodyOf(values);
  if (!checked.ok) return fieldsRefused(values, checked.fields);
  return afterSave(
    await updateAccount(formText(form, 'id'), { ...checked.body, version: Number(formText(form, 'version')) }),
    values,
    EDIT_FIELDS,
  );
}

/**
 * Desativa ou reativa a conta, com a versão lida, pelo botão do detalhe, que não é um formulário. A conta
 * é lida de novo também na recusa, então o conflito de versão diz que a tela já está atualizada.
 */
export async function setAccountActiveAction(
  _previous: CommandMessage,
  { id, active, version }: { id: string; active: boolean; version: number },
): Promise<CommandMessage> {
  const result = await setAccountActive(id, active, version);
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  revalidatePath('/accounts', 'layout');
  if (result.ok) return { message: null };
  if (result.code === 'VERSION_CONFLICT') {
    return {
      message: 'Esta conta mudou desde que você a abriu. A tela já mostra os dados atuais: confira e tente de novo.',
    };
  }
  return { message: result.message };
}

/** Uma página da lista das contas do contexto, com a busca, pedida pela lista da tela. */
export async function searchAccountsAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<AccountListItem>> {
  return listPageResult(await listAccounts(page, q), accountListItem);
}

/** Uma página do histórico de alterações da conta, pedida pelo painel do detalhe, já dita como a tela a mostra. */
export async function accountHistoryAction({
  id,
  page,
}: {
  id: string;
  page: number;
}): Promise<ListPageResult<HistoryItem>> {
  return listPageResult(await getAccountHistory(id, page), accountHistoryItem);
}

/** O que foi enviado no formulário de uma movimentação, que volta aos campos depois de uma recusa. */
export interface MovementFormValues {
  readonly direction: MovementDirection;
  readonly date: string;
  readonly amount: string;
  readonly description: string;
}

/** O que o diálogo de nova movimentação mostra depois de um envio. */
export type MovementFormState = SavableFormState<MovementFormValues>;

/** Os campos do diálogo com o erro ao lado, pelo nome deles no contrato. */
const MOVEMENT_FIELDS: ReadonlySet<string> = new Set(['direction', 'date', 'amount', 'description']);

/**
 * Registra a movimentação do diálogo na conta e lê de novo o detalhe e a lista, com os saldos, o que fecha
 * o diálogo. O valor digitado vira a string decimal da api.
 */
export async function createMovementAction(_previous: MovementFormState, form: FormData): Promise<MovementFormState> {
  const values: MovementFormValues = {
    direction: formText(form, 'direction') === 'inflow' ? 'inflow' : 'outflow',
    date: formText(form, 'date'),
    amount: formText(form, 'amount'),
    description: formText(form, 'description'),
  };
  const amount = parseMoneyInput(values.amount);
  if (amount === null) return fieldRefusal(values, 'amount', 'Informe o valor, maior que zero, como 1.234,56.');
  const result = await createMovement(formText(form, 'accountId'), {
    direction: values.direction,
    date: values.date,
    amount,
    description: values.description,
  });
  if (result.ok) {
    revalidatePath('/accounts', 'layout');
    return SAVED_FORM_STATE;
  }
  return { ...UNSAVED_FORM_STATE, ...refusedFormState(result, values, MOVEMENT_FIELDS, {}) };
}

/** O saldo calculado da conta no fim do dia, pedido pelo diálogo do ajuste a cada data escolhida. */
export async function accountBalanceAction({ id, date }: { id: string; date: string }): Promise<BalanceOnDate> {
  return balanceOnDate(await getAccountBalance(id, date));
}

/** O que foi enviado no formulário do ajuste, que volta aos campos depois de uma recusa. */
export interface AdjustmentFormValues {
  readonly date: string;
  readonly bankBalance: string;
  readonly reason: string;
}

/** O que o diálogo do ajuste mostra depois de um envio. */
export type AdjustmentFormState = SavableFormState<AdjustmentFormValues>;

/** Os campos do diálogo do ajuste com o erro ao lado, pelo nome deles no contrato. */
const ADJUSTMENT_FIELDS: ReadonlySet<string> = new Set(['date', 'bankBalance', 'reason']);

/** As recusas de regra do ajuste que são de um campo, e o campo delas. */
const ADJUSTMENT_FIELD_OF_CODE: Readonly<Record<string, string>> = {
  BALANCE_ALREADY_MATCHES: 'bankBalance',
  DATE_BEFORE_OPENING_BALANCE: 'date',
};

/**
 * Registra o ajuste do diálogo na conta e lê de novo o detalhe e a lista, com os saldos, o que fecha o
 * diálogo. O saldo digitado vira a string decimal da api, que calcula a diferença.
 */
export async function createAdjustmentAction(
  _previous: AdjustmentFormState,
  form: FormData,
): Promise<AdjustmentFormState> {
  const values: AdjustmentFormValues = {
    date: formText(form, 'date'),
    bankBalance: formText(form, 'bankBalance'),
    reason: formText(form, 'reason'),
  };
  const bankBalance = parseMoneyInput(values.bankBalance);
  if (bankBalance === null) return fieldRefusal(values, 'bankBalance', 'Informe o saldo do banco, como 1.234,56.');
  const result = await createAdjustment(formText(form, 'accountId'), {
    date: values.date,
    bankBalance,
    reason: values.reason,
  });
  if (result.ok) {
    revalidatePath('/accounts', 'layout');
    return SAVED_FORM_STATE;
  }
  return { ...UNSAVED_FORM_STATE, ...refusedFormState(result, values, ADJUSTMENT_FIELDS, ADJUSTMENT_FIELD_OF_CODE) };
}
