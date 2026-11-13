'use client';

import { useActionState } from 'react';

import { AccessFootnote, AccessHeading } from '../../_access/access-screen';
import { ErrorNotice, PasswordField, SubmitButton } from '../../_access/fields';
import { ExpiredLink } from './expired-link';
import { setPasswordAction, type SetPasswordState } from './actions';

const INITIAL: SetPasswordState = { expired: false, message: null, fields: {} };

export function SetPasswordForm({ token, email }: Readonly<{ token: string; email: string }>) {
  const [state, action] = useActionState(setPasswordAction, INITIAL);
  if (state.expired) return <ExpiredLink />;
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* O token vai num campo do formulário, como as senhas (ver o AGENTS.md da web, "Ações do servidor"). */}
      <input type="hidden" name="token" value={token} />
      <AccessHeading title="Defina sua senha">Link de uso único para {email}.</AccessHeading>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <PasswordField
        id="password"
        name="password"
        label="Nova senha"
        autoComplete="new-password"
        showLabel="Mostrar a nova senha"
        help="Pelo menos 12 caracteres."
        error={state.fields.password}
      />
      <PasswordField
        id="passwordConfirmation"
        name="passwordConfirmation"
        label="Repita a senha"
        autoComplete="new-password"
        showLabel="Mostrar a senha repetida"
        error={state.fields.passwordConfirmation}
      />
      <SubmitButton>Salvar senha e entrar</SubmitButton>
      <AccessFootnote>Salvar encerra todas as outras sessões desta conta.</AccessFootnote>
    </form>
  );
}
