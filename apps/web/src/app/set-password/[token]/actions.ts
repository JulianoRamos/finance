'use server';

import { redirect } from 'next/navigation';

import { storeSession } from '@/api/session-cookie';
import { redeemRecoveryLink } from '@/api/sessions';

import { formText } from '../../_access/form-text';

/** O que a tela de definir a senha mostra depois de um envio recusado. */
export interface SetPasswordState {
  /** O link venceu ou já foi usado. */
  readonly expired: boolean;
  /** A recusa que não é de um campo, como tentativas demais. */
  readonly message: string | null;
  /** O motivo de cada campo recusado. */
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * Usa o link do formulário (o token vai num campo oculto) com a senha dele, guarda a sessão no cookie e
 * vai para a página inicial.
 */
export async function setPasswordAction(_previous: SetPasswordState, form: FormData): Promise<SetPasswordState> {
  const token = formText(form, 'token');
  const result = await redeemRecoveryLink(token, formText(form, 'password'), formText(form, 'passwordConfirmation'));
  if (!result.ok) {
    // A entrada recusada é mostrada em cada campo; as outras recusas, no aviso.
    const invalidInput = result.code === 'INVALID_INPUT';
    return {
      expired: result.code === 'NOT_FOUND',
      message: invalidInput ? null : result.message,
      fields: result.fields ?? {},
    };
  }
  await storeSession(result.session);
  redirect('/');
}
