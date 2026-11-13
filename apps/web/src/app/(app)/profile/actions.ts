'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { endSession } from '@/api/sessions';
import { changePassword } from '@/api/users';

import { formText } from '../../_access/form-text';

/** Encerra a sessão do id do formulário e mostra a lista de novo. */
export async function endSessionAction(form: FormData): Promise<void> {
  const result = await endSession(formText(form, 'id'));
  if (!result.ok && result.code === 'UNAUTHENTICATED') redirect('/login');
  // A sessão que já não estava ativa (404) também sai da lista, que é lida de novo.
  revalidatePath('/profile');
}

/** O que o formulário da troca de senha mostra depois de um envio. */
export interface ChangePasswordState {
  /** A troca deu certo: o aviso aparece e os campos se limpam. */
  readonly done: boolean;
  /** O erro que não é de um campo, como tentativas demais ou a api fora do ar. */
  readonly message: string | null;
  /** O motivo da recusa de cada campo, pelo nome dele no contrato. */
  readonly fields: Readonly<Record<string, string>>;
}

/** Troca a senha com os campos do formulário. */
export async function changePasswordAction(
  _previous: ChangePasswordState,
  form: FormData,
): Promise<ChangePasswordState> {
  const result = await changePassword({
    currentPassword: formText(form, 'currentPassword'),
    password: formText(form, 'password'),
    passwordConfirmation: formText(form, 'passwordConfirmation'),
  });
  if (result.ok) {
    revalidatePath('/profile');
    return { done: true, message: null, fields: {} };
  }
  if (result.code === 'UNAUTHENTICATED') redirect('/login');
  if (result.code === 'INVALID_CURRENT_PASSWORD') {
    return { done: false, message: null, fields: { currentPassword: result.message } };
  }
  if (result.fields) return { done: false, message: null, fields: result.fields };
  return { done: false, message: result.message, fields: {} };
}
