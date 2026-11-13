'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  createEntity,
  disableOperation,
  type EntityResult,
  type EntityType,
  enableOperation,
  setEntityActive,
  updateEntity,
} from '@/api/entities';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';

/** O que foi enviado no formulário de uma entidade, que volta aos campos depois de uma recusa. */
export interface EntityFormValues {
  readonly type: EntityType | null;
  readonly name: string;
  readonly taxId: string;
  readonly clinic: boolean;
}

/** O que o formulário de uma entidade mostra depois de um envio recusado. */
export interface EntityFormState {
  /**
   * O que foi enviado, ou nulo antes do primeiro envio. O React limpa o formulário depois de cada envio
   * com ação, e os campos voltam a estes valores.
   */
  readonly values: EntityFormValues | null;
  /** A recusa que não é de um campo, como a versão desatualizada ou a api fora do ar. */
  readonly message: string | null;
  /** Se a recusa foi pela versão desatualizada, que pede para recarregar a entidade. */
  readonly conflict: boolean;
  /** O motivo da recusa de cada campo, pelo nome dele no contrato. */
  readonly fields: Readonly<Record<string, string>>;
}

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
    redirect(`/entities/${result.entity.id}`);
  }
  if (result.code === 'UNAUTHENTICATED') redirect('/login');
  const ruleField = FIELD_OF_CODE[result.code];
  const fields = result.fields ?? (ruleField ? { [ruleField]: result.message } : {});
  // Um campo que o formulário não mostra, como a versão oculta, não pode recusar sem dizer nada.
  const placed = Object.keys(fields).length > 0 && Object.keys(fields).every((field) => shown.has(field));
  return { values, message: placed ? null : result.message, conflict: result.code === 'VERSION_CONFLICT', fields };
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
