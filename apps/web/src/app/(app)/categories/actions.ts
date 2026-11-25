'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { DataResult } from '@/api/api-error';
import {
  type Category,
  type CategoryEdit,
  type CategoryNature,
  createCategory,
  listParentChoices,
  type ParentChoice,
  setCategoryActive,
  updateCategory,
} from '@/api/categories';

import { formText } from '../../_access/form-text';
import type { CommandMessage } from '../../_shell/confirm-dialog';
import { refusedFormState, SAVED_FORM_STATE, type SavableFormState } from '../../_shell/form-state';

/** O que foi enviado no formulário de uma categoria nova, que volta aos campos depois de uma recusa. */
export interface NewCategoryValues {
  readonly name: string;
  readonly nature: CategoryNature;
}

/** Os campos que o formulário da categoria nova mostra com o erro ao lado. */
const CREATE_FIELDS: ReadonlySet<string> = new Set(['name', 'nature']);

/** A mensagem do conflito de versão, depois de a árvore ser lida de novo. */
const CONFLICT_MESSAGE =
  'Esta categoria mudou desde que você a abriu. A árvore já mostra os dados atuais: confira e tente de novo.';

/** A árvore lida de novo depois de um comando, aceito ou não; sem sessão, vai para o login. */
function afterCommand<T>(result: DataResult<T>): void {
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  revalidatePath('/categories');
}

/**
 * Cria a categoria do formulário: de primeiro nível, com a natureza escolhida, ou a subcategoria do pai
 * oculto, que tem a natureza dele.
 */
export async function createCategoryAction(
  _previous: SavableFormState<NewCategoryValues>,
  form: FormData,
): Promise<SavableFormState<NewCategoryValues>> {
  const parentId = formText(form, 'parentId');
  const values: NewCategoryValues = {
    name: formText(form, 'name'),
    nature: formText(form, 'nature') === 'revenue' ? 'revenue' : 'expense',
  };
  const result = await createCategory(
    parentId === '' ? { name: values.name, nature: values.nature } : { name: values.name, parentId },
  );
  afterCommand(result);
  return result.ok ? SAVED_FORM_STATE : { ...refusedFormState(result, values, CREATE_FIELDS, {}), saved: false };
}

/**
 * O que um comando sobre uma categoria devolve à tela: a recusa, se houve, e a categoria como ficou, quando
 * ele foi aceito.
 */
export interface CategoryCommandResult extends CommandMessage {
  readonly saved: Category | null;
}

/** O resultado de um comando, com a mensagem do conflito de versão. */
function commandResult(result: DataResult<Category>): CategoryCommandResult {
  afterCommand(result);
  if (result.ok) return { message: null, saved: result.data };
  return { message: result.code === 'VERSION_CONFLICT' ? CONFLICT_MESSAGE : result.message, saved: null };
}

/** Renomeia a categoria ou muda o pai dela, com a versão lida: o renomear da linha e o "Mover para…". */
export async function editCategoryAction(
  _previous: CategoryCommandResult,
  { id, ...body }: CategoryEdit & { readonly id: string },
): Promise<CategoryCommandResult> {
  return commandResult(await updateCategory(id, body));
}

/** Desativa ou reativa a categoria, com a versão lida, pelo menu da linha. */
export async function setCategoryActiveAction(
  _previous: CategoryCommandResult,
  { id, active, version }: { id: string; active: boolean; version: number },
): Promise<CategoryCommandResult> {
  return commandResult(await setCategoryActive(id, active, version));
}

/**
 * As categorias de primeiro nível ativas da natureza, que o "Mover para…" oferece como o novo pai, pedidas
 * só quando ele abre; nula quando a api não responde.
 */
export async function parentChoicesAction(nature: CategoryNature): Promise<ParentChoice[] | null> {
  const result = await listParentChoices(nature);
  if (result.status === 'unauthenticated') redirect('/login');
  return result.status === 'ok' ? result.data : null;
}
