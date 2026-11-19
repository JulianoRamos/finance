'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createEntity,
  disableOperation,
  type EntityResult,
  type EntityType,
  enableOperation,
  getEntityHistory,
  listEntities,
  setEntityActive,
  updateEntity,
} from '@/api/entities';
import { createEquityStake, endEquityStake } from '@/api/equity-stakes';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import { formatFraction, percentToFraction } from '../../_shell/format';
import { type FormState, INITIAL_FORM_STATE, refusedFormState } from '../../_shell/form-state';
import { listPageResult, type ListPageResult } from '../../_shell/list-page';
import { type HistoryItem, historyItem } from './[id]/history-entry';
import { type EntityListItem, entityListItem } from './entity-list-page';
import { type EntityOption, entityOption } from './entity-option';

/** O que foi enviado no formulário de uma entidade, que volta aos campos depois de uma recusa. */
export interface EntityFormValues {
  readonly type: EntityType | null;
  readonly name: string;
  readonly taxId: string;
  readonly clinic: boolean;
}

/** O que o formulário de uma entidade mostra depois de um envio recusado. */
export type EntityFormState = FormState<EntityFormValues>;

/** Os campos que cada formulário mostra com o erro ao lado; a recusa de outro campo vai para o aviso. */
const CREATE_FIELDS: ReadonlySet<string> = new Set(['type', 'name', 'taxId', 'operations']);
const EDIT_FIELDS: ReadonlySet<string> = new Set(['name', 'taxId']);

/**
 * As recusas de regra que são de um campo, e o campo delas. O corpo de erro só traz `fields` na
 * entrada inválida (LLD, seção 5), então a web liga o código ao campo.
 */
const FIELD_OF_CODE: Readonly<Record<string, string>> = { DUPLICATE_TAX_ID: 'taxId' };

/** O que foi enviado no formulário. */
function valuesOf(form: FormData): EntityFormValues {
  const type = formText(form, 'type');
  return {
    type: type === 'individual' || type === 'company' ? type : null,
    name: formText(form, 'name'),
    taxId: formText(form, 'taxId'),
    clinic: form.get('clinic') === 'on',
  };
}

/**
 * Mostra a entidade que o comando deixou, com a lista lida de novo, ou devolve a recusa para o
 * formulário: a de um campo que ele mostra no campo, e as outras no aviso.
 */
function afterSave(result: EntityResult, values: EntityFormValues, shown: ReadonlySet<string>): EntityFormState {
  if (result.ok) {
    revalidatePath('/entities', 'layout');
    redirect(`/entities/${result.data.id}`);
  }
  return refusedFormState(result, values, shown, FIELD_OF_CODE);
}

/** Cadastra a entidade do formulário e abre o detalhe dela. */
export async function createEntityAction(_previous: EntityFormState, form: FormData): Promise<EntityFormState> {
  const values = valuesOf(form);
  const { type } = values;
  if (!type) {
    return { values, message: null, conflict: false, fields: { type: 'Escolha pessoa física ou pessoa jurídica.' } };
  }
  const result = await createEntity({
    type,
    name: values.name,
    taxId: values.taxId,
    operations: type === 'company' && values.clinic ? ['clinic'] : [],
  });
  return afterSave(result, values, CREATE_FIELDS);
}

/** Salva o nome e o documento da entidade do formulário, com a versão lida, e volta ao detalhe. */
export async function updateEntityAction(_previous: EntityFormState, form: FormData): Promise<EntityFormState> {
  const values = valuesOf(form);
  const { type } = values;
  if (!type) return { values, message: 'Recarregue a entidade e tente de novo.', conflict: false, fields: {} };
  const result = await updateEntity(formText(form, 'id'), {
    version: Number(formText(form, 'version')),
    type,
    name: values.name,
    taxId: values.taxId,
  });
  return afterSave(result, values, EDIT_FIELDS);
}

/** O que o detalhe mostra depois de um comando sobre a entidade: a recusa, se houve. */
export type EntityCommandState = CommandMessage;

/**
 * Mostra a entidade de novo, com a lista, ou devolve a recusa para o detalhe. A entidade é lida de novo
 * também na recusa, então o conflito de versão diz que a tela já está atualizada.
 */
function afterCommand(result: EntityResult): EntityCommandState {
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  revalidatePath('/entities', 'layout');
  if (result.ok) return { message: null };
  if (result.code === 'VERSION_CONFLICT') {
    return {
      message: 'Esta entidade mudou desde que você a abriu. A tela já mostra os dados atuais: confira e tente de novo.',
    };
  }
  return { message: result.message };
}

/** Desativa ou reativa a entidade, com a versão lida, pelo botão do detalhe, que não é um formulário. */
export async function setActiveAction(
  _previous: EntityCommandState,
  { id, active, version }: { id: string; active: boolean; version: number },
): Promise<EntityCommandState> {
  return afterCommand(await setEntityActive(id, active, version));
}

/** Liga ou desliga a operação de clínica na empresa, pela chave do detalhe, que não é um formulário. */
export async function setClinicAction(
  _previous: EntityCommandState,
  { id, enabled }: { id: string; enabled: boolean },
): Promise<EntityCommandState> {
  return afterCommand(enabled ? await enableOperation(id, 'clinic') : await disableOperation(id, 'clinic'));
}

/** Uma página da lista das entidades, com a busca, pedida pela lista da tela. */
export async function searchEntitiesAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<EntityListItem>> {
  return listPageResult(await listEntities(page, q), entityListItem);
}

/**
 * Uma página das entidades ativas, com a busca, pedida pelas escolhas que as oferecem: os membros de um
 * grupo e o sócio de uma participação.
 */
export async function searchEntityOptionsAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<EntityOption>> {
  return listPageResult(await listEntities(page, q, true), entityOption);
}

/**
 * Uma página do histórico de alterações da entidade, pedida pelo painel do detalhe, com cada alteração
 * já dita como a tela a mostra. O tipo da entidade, que não muda, formata o documento.
 */
export async function entityHistoryAction({
  id,
  type,
  page,
}: {
  id: string;
  type: EntityType;
  page: number;
}): Promise<ListPageResult<HistoryItem>> {
  return listPageResult(await getEntityHistory(id, page), (entry) => historyItem(entry, type));
}

/** O que foi enviado no formulário de registrar uma participação, com a fração em percentual. */
export interface EquityStakeFormValues {
  readonly holderId: string;
  readonly holderName: string;
  readonly percent: string;
  readonly startDate: string;
  readonly endDate: string;
}

/** O que o formulário de registrar uma participação mostra depois de um envio recusado. */
export type EquityStakeFormState = FormState<EquityStakeFormValues> & {
  /** Se o envio foi aceito: aí o formulário fecha. */
  readonly saved: boolean;
};

/** Os campos do registro com o erro ao lado, pelo nome deles no contrato. */
const STAKE_FIELDS: ReadonlySet<string> = new Set(['holderId', 'fraction', 'startDate', 'endDate']);

/** As recusas do registro que são do sócio escolhido (regra 6.2). */
const STAKE_FIELD_OF_CODE: Readonly<Record<string, string>> = {
  ENTITY_NOT_FOUND: 'holderId',
  INACTIVE_ENTITY: 'holderId',
  EQUITY_STAKE_SELF: 'holderId',
  EQUITY_STAKE_CYCLE: 'holderId',
};

/** A recusa de um campo, antes de pedir à api. */
function fieldRefusal<Values>(values: Values, field: string, message: string): FormState<Values> & { saved: false } {
  return { values, message: null, conflict: false, fields: { [field]: message }, saved: false };
}

/**
 * A recusa da fração, dita em percentual, como o campo a pede: a da api fala da fração de 0 a 1, com as 8
 * casas dela.
 */
const PERCENT_REFUSAL = 'Informe a fração em percentual, de mais de 0 até 100, com até 6 casas.';

/** O envio aceito, que fecha o formulário. */
const SAVED = { ...INITIAL_FORM_STATE, saved: true } as const;

/**
 * Registra a participação do formulário na empresa e mostra a tabela de novo, que fecha o formulário. O
 * percentual digitado vira a fração da api; a soma acima de 100% é dita como o protótipo a diz.
 */
export async function createEquityStakeAction(
  _previous: EquityStakeFormState,
  form: FormData,
): Promise<EquityStakeFormState> {
  const companyId = formText(form, 'companyId');
  const values: EquityStakeFormValues = {
    holderId: formText(form, 'holderId'),
    holderName: formText(form, 'holderName'),
    percent: formText(form, 'percent'),
    startDate: formText(form, 'startDate'),
    endDate: formText(form, 'endDate'),
  };
  if (!values.holderId) return fieldRefusal(values, 'holderId', 'Escolha o sócio.');
  const fraction = percentToFraction(values.percent);
  if (!fraction) return fieldRefusal(values, 'fraction', PERCENT_REFUSAL);
  const result = await createEquityStake(companyId, {
    holderId: values.holderId,
    fraction,
    startDate: values.startDate,
    endDate: values.endDate || null,
  });
  if (result.ok) {
    revalidatePath(`/entities/${companyId}`);
    return SAVED;
  }
  if (result.code === 'EQUITY_STAKE_OVER_LIMIT') {
    return {
      values,
      message: `${values.holderName} com ${formatFraction(fraction)} passaria de 100% das participações vigentes. Encerre outra participação antes.`,
      conflict: false,
      fields: {},
      saved: false,
    };
  }
  const refused = refusedFormState(result, values, STAKE_FIELDS, STAKE_FIELD_OF_CODE);
  const fields = refused.fields.fraction ? { ...refused.fields, fraction: PERCENT_REFUSAL } : refused.fields;
  return { ...refused, fields, saved: false };
}

/** O que foi enviado no formulário de encerrar uma participação. */
export interface EndEquityStakeFormValues {
  readonly endDate: string;
}

/** O que o formulário de encerrar uma participação mostra depois de um envio recusado. */
export type EndEquityStakeFormState = FormState<EndEquityStakeFormValues> & {
  /** Se o encerramento foi aceito: aí o formulário fecha. */
  readonly saved: boolean;
};

/** Encerra a participação com o último dia, com a versão lida, e mostra a tabela de novo. */
export async function endEquityStakeAction(
  _previous: EndEquityStakeFormState,
  form: FormData,
): Promise<EndEquityStakeFormState> {
  const companyId = formText(form, 'companyId');
  const values: EndEquityStakeFormValues = { endDate: formText(form, 'endDate') };
  const result = await endEquityStake(companyId, formText(form, 'stakeId'), {
    version: Number(formText(form, 'version')),
    endDate: values.endDate,
  });
  if (result.ok) {
    revalidatePath(`/entities/${companyId}`);
    return SAVED;
  }
  return { ...refusedFormState(result, values, new Set(['endDate']), {}), saved: false };
}
