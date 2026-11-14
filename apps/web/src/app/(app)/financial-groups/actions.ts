'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { listEntities } from '@/api/entities';
import {
  createFinancialGroup,
  deleteFinancialGroup,
  type FinancialGroupResult,
  listFinancialGroups,
  updateFinancialGroup,
} from '@/api/financial-groups';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import { type FormState, refusedFormState } from '../../_shell/form-state';
import { listPageResult, type ListPageResult } from '../../_shell/list-page';
import type { MemberOption } from './group-form';
import { type GroupListItem, groupListItem } from './group-list-page';
import { memberOption } from './member-options';

/** O que foi enviado no formulário de um grupo, que volta aos campos depois de uma recusa. */
export interface GroupFormValues {
  readonly name: string;
  readonly memberIds: readonly string[];
}

/** O que o formulário de um grupo mostra depois de um envio recusado. */
export type GroupFormState = FormState<GroupFormValues>;

/** Os campos que o formulário mostra com o erro ao lado; a recusa de outro campo vai para o aviso. */
const SHOWN_FIELDS: ReadonlySet<string> = new Set(['name', 'memberIds']);

/** As recusas de regra que são dos membros, e não de um campo da entrada. */
const FIELD_OF_CODE: Readonly<Record<string, string>> = {
  INACTIVE_ENTITY: 'memberIds',
  ENTITY_NOT_FOUND: 'memberIds',
  FAMILY_VIEW_INDIVIDUALS_ONLY: 'memberIds',
};

/** O que foi enviado no formulário. */
function valuesOf(form: FormData): GroupFormValues {
  return {
    name: formText(form, 'name'),
    memberIds: form.getAll('memberIds').filter((value) => typeof value === 'string'),
  };
}

/**
 * Abre o grupo que o comando deixou, com a lista lida de novo, ou devolve a recusa para o formulário:
 * a de um campo que ele mostra no campo, e as outras no aviso.
 */
function afterSave(result: FinancialGroupResult, values: GroupFormValues): GroupFormState {
  if (result.ok) {
    revalidatePath('/financial-groups', 'layout');
    redirect(`/financial-groups/${result.data.id}`);
  }
  return refusedFormState(result, values, SHOWN_FIELDS, FIELD_OF_CODE);
}

/** Cria o grupo do formulário e abre o formulário dele. */
export async function createGroupAction(_previous: GroupFormState, form: FormData): Promise<GroupFormState> {
  const values = valuesOf(form);
  return afterSave(await createFinancialGroup({ name: values.name, memberIds: [...values.memberIds] }), values);
}

/**
 * Salva o nome e os membros do grupo do formulário, com a versão lida. A Visão Familiar manda o nome
 * atual, num campo oculto, e muda só os membros.
 */
export async function updateGroupAction(_previous: GroupFormState, form: FormData): Promise<GroupFormState> {
  const values = valuesOf(form);
  const result = await updateFinancialGroup(formText(form, 'id'), {
    version: Number(formText(form, 'version')),
    name: values.name,
    memberIds: [...values.memberIds],
  });
  return afterSave(result, values);
}

/** Exclui o grupo, pela confirmação, e volta para a Visão Familiar. */
export async function deleteGroupAction(_previous: CommandMessage, { id }: { id: string }): Promise<CommandMessage> {
  const result = await deleteFinancialGroup(id);
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  revalidatePath('/financial-groups', 'layout');
  if (result.ok) redirect('/financial-groups');
  return { message: result.message };
}

/** Uma página da lista dos grupos, com a busca, pedida pela lista da tela. */
export async function searchFinancialGroupsAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<GroupListItem>> {
  return listPageResult(await listFinancialGroups(page, q), groupListItem);
}

/** Uma página das entidades ativas, com a busca, pedida pela escolha dos membros. */
export async function searchMemberOptionsAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<MemberOption>> {
  return listPageResult(await listEntities(page, q, true), memberOption);
}
