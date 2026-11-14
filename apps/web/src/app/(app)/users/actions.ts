'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ApiError, DataResult } from '@/api/api-error';
import {
  createRecoveryLink,
  createUser,
  type GeneratedRecoveryLink,
  listUserPermissions,
  listUsers,
  type PermissionChange,
  setUserAccess,
  setUserActive,
  updateUser,
  type User,
} from '@/api/users';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import { formatInstant } from '../../_shell/format';
import { type FormState, INITIAL_FORM_STATE, refusedFormState } from '../../_shell/form-state';
import { listPageResult, type ListPageResult } from '../../_shell/list-page';
import { type PermissionRow, type UserListItem, userListItem } from './user-list-page';

/** O link de recuperação como a tela o mostra uma vez: o endereço inteiro e o prazo, já formatado. */
interface ShownRecoveryLink {
  readonly url: string;
  /** O prazo como `dd/mm/aaaa hh:mm`, formatado no servidor, no fuso do processo da web. */
  readonly expiresAt: string;
}

/** O link gerado, com o prazo formatado no servidor: no navegador, o fuso poderia mudar a hora. */
function shownLink(link: GeneratedRecoveryLink): ShownRecoveryLink {
  return { url: link.url, expiresAt: formatInstant(link.expiresAt) };
}

/** O que foi enviado no formulário de um usuário, que volta aos campos depois de uma recusa. */
export interface UserFormValues {
  readonly name: string;
  readonly email: string;
  readonly managesAccess: boolean;
}

/**
 * O que o formulário do cadastro mostra depois de um envio: a recusa, ou o usuário criado e o link para
 * ele definir a senha, mostrado uma vez só.
 */
export type NewUserFormState = FormState<UserFormValues> & {
  readonly created: { readonly user: User; readonly link: ShownRecoveryLink } | null;
};

/** O que o formulário da edição mostra depois de um envio recusado. */
export type UserEditFormState = FormState<UserFormValues>;

/** As recusas de regra que são de um campo, e o campo delas (LLD, seção 5). */
const FIELD_OF_CODE: Readonly<Record<string, string>> = { DUPLICATE_EMAIL: 'email' };
/** Os campos que os formulários mostram com o erro ao lado; a recusa de outro campo vai para o aviso. */
const SHOWN_FIELDS: ReadonlySet<string> = new Set(['name', 'email']);

/** O que foi enviado no formulário. */
function valuesOf(form: FormData): UserFormValues {
  return {
    name: formText(form, 'name'),
    email: formText(form, 'email'),
    managesAccess: form.get('managesAccess') === 'on',
  };
}

/**
 * As permissões escolhidas na tabela, que o formulário manda num campo oculto, em JSON. A api confere
 * cada uma e recusa a lista inválida com 400.
 */
function permissionsOf(form: FormData): PermissionChange[] {
  try {
    const parsed: unknown = JSON.parse(formText(form, 'permissions') || '[]');
    return Array.isArray(parsed) ? (parsed as PermissionChange[]) : [];
  } catch {
    return [];
  }
}

/** Cadastra o usuário do formulário e mostra, no lugar dele, o link para o usuário definir a senha. */
export async function createUserAction(_previous: NewUserFormState, form: FormData): Promise<NewUserFormState> {
  const values = valuesOf(form);
  const result = await createUser({ ...values, permissions: permissionsOf(form) });
  if (!result.ok) return { ...refusedFormState(result, values, SHOWN_FIELDS, FIELD_OF_CODE), created: null };
  revalidatePath('/users', 'layout');
  return {
    ...INITIAL_FORM_STATE,
    values,
    created: { user: result.data.user, link: shownLink(result.data.recoveryLink) },
  };
}

/** Salva o nome e o e-mail do usuário do formulário, com a versão lida, e volta ao detalhe. */
export async function updateUserAction(_previous: UserEditFormState, form: FormData): Promise<UserEditFormState> {
  const values = valuesOf(form);
  const id = formText(form, 'id');
  const result = await updateUser(id, {
    version: Number(formText(form, 'version')),
    name: values.name,
    email: values.email,
  });
  if (!result.ok) return refusedFormState(result, values, SHOWN_FIELDS, FIELD_OF_CODE);
  revalidatePath('/users', 'layout');
  redirect(`/users/${id}`);
}

/**
 * A recusa de um comando do detalhe, que é lido de novo também na recusa: o conflito de versão diz que
 * a tela já está atualizada.
 */
function refusedCommand(error: ApiError): string {
  if (error.code === 'UNAUTHENTICATED') redirect('/login');
  if (error.code === 'VERSION_CONFLICT') {
    return 'Este usuário mudou desde que você o abriu. A tela já mostra os dados atuais: confira e tente de novo.';
  }
  return error.message;
}

/** Mostra o usuário de novo, com a lista, ou devolve a recusa para o detalhe. */
function afterCommand(result: DataResult<User>): CommandMessage {
  const message = result.ok ? null : refusedCommand(result);
  revalidatePath('/users', 'layout');
  return { message };
}

/** Desativa ou reativa o usuário, com a versão lida, pelo botão do detalhe, que não é um formulário. */
export async function setUserActiveAction(
  _previous: CommandMessage,
  { id, active, version }: { id: string; active: boolean; version: number },
): Promise<CommandMessage> {
  return afterCommand(await setUserActive(id, active, version));
}

/** Grava o gerir acessos e as permissões que mudaram, em qualquer página da tabela, com a versão lida. */
export async function saveAccessAction(
  _previous: CommandMessage,
  payload: { id: string; version: number; managesAccess: boolean; permissions: PermissionChange[] },
): Promise<CommandMessage> {
  const { id, ...body } = payload;
  return afterCommand(await setUserAccess(id, body));
}

/** O que o detalhe mostra depois de gerar um link: ele, uma vez só, ou a recusa. */
interface RecoveryLinkState {
  readonly message: string | null;
  readonly link: ShownRecoveryLink | null;
}

/** Gera um link de recuperação para o usuário, pelo botão do detalhe. */
export async function generateRecoveryLinkAction(
  _previous: RecoveryLinkState,
  { id }: { id: string },
): Promise<RecoveryLinkState> {
  const result = await createRecoveryLink(id);
  if (result.ok) return { message: null, link: shownLink(result.data) };
  return { message: refusedCommand(result), link: null };
}

/** Uma página da lista dos usuários, com a busca, pedida pela lista da tela. */
export async function searchUsersAction({
  q,
  page,
}: {
  q: string;
  page: number;
}): Promise<ListPageResult<UserListItem>> {
  return listPageResult(await listUsers(page, q), userListItem);
}

/** Uma página da tabela de permissões do usuário, com a busca das entidades. */
export async function searchPermissionsAction({
  userId,
  q,
  page,
}: {
  userId: string;
  q: string;
  page: number;
}): Promise<ListPageResult<PermissionRow>> {
  return listPageResult(await listUserPermissions(userId, page, q), (row) => row);
}
