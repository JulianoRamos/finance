'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { AccessFootnote, AccessHeading, FOCUS_RING } from '../_access/access-screen';
import { EmailField, ErrorNotice, PasswordField, SubmitButton } from '../_access/fields';
import { loginAction, type LoginState } from './actions';

const INITIAL: LoginState = { message: null, email: '' };

export function LoginForm() {
  const [state, action] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4">
      <AccessHeading title="Entrar no Finance">Use o e-mail e a senha da sua conta.</AccessHeading>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <EmailField id="email" name="email" label="E-mail" autoComplete="username" defaultValue={state.email} />
      <PasswordField
        id="password"
        name="password"
        label="Senha"
        autoComplete="current-password"
        showLabel="Mostrar a senha"
      />
      <Link href="/recover-access" className={`self-start rounded-sm text-label text-link ${FOCUS_RING}`}>
        Esqueceu a senha?
      </Link>
      <SubmitButton>Entrar</SubmitButton>
      <AccessFootnote>A sessão fica aberta por até 7 dias sem uso e 30 dias no máximo.</AccessFootnote>
    </form>
  );
}
