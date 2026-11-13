'use server';

import { redirect } from 'next/navigation';

import { storeSession } from '@/api/session-cookie';
import { login } from '@/api/sessions';

import { formText } from '../_access/form-text';

/** O que a tela de login mostra depois de um envio recusado. */
export interface LoginState {
  readonly message: string | null;
  readonly email: string;
}

/** Entra com o e-mail e a senha do formulário, guarda a sessão no cookie e vai para a página inicial. */
export async function loginAction(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = formText(form, 'email');
  const result = await login(email, formText(form, 'password'));
  if (!result.ok) return { message: result.message, email };
  await storeSession(result.session);
  redirect('/');
}
