'use client';

import { CircleCheck } from 'lucide-react';
import { useActionState } from 'react';

import { ErrorNotice, PasswordField, SubmitButton } from '../../_access/fields';
import { changePasswordAction, type ChangePasswordState } from './actions';

const INITIAL: ChangePasswordState = { done: false, message: null, fields: {} };

/** A troca de senha: a senha atual, a nova e a repetição. */
export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, INITIAL);
  return (
    <>
      {state.done && (
        <p
          role="status"
          className="flex items-start gap-3 rounded-md border border-positive bg-positive-soft px-4 py-3 text-ink"
        >
          <CircleCheck size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 flex-none text-positive" />
          Senha trocada. As suas outras sessões foram encerradas.
        </p>
      )}
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      {/* O React limpa os campos depois de cada envio do formulário com ação. */}
      <form action={action} className="flex flex-col gap-4">
        <PasswordField
          id="current-password"
          name="currentPassword"
          label="Senha atual"
          autoComplete="current-password"
          size="app"
          showLabel="Mostrar a senha atual"
          error={state.fields.currentPassword}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <PasswordField
            id="new-password"
            name="password"
            label="Nova senha"
            autoComplete="new-password"
            size="app"
            showLabel="Mostrar a nova senha"
            help="Pelo menos 12 caracteres."
            error={state.fields.password}
          />
          <PasswordField
            id="new-password-confirmation"
            name="passwordConfirmation"
            label="Repita a nova senha"
            autoComplete="new-password"
            size="app"
            showLabel="Mostrar a repetição da nova senha"
            error={state.fields.passwordConfirmation}
          />
        </div>
        <div className="flex justify-end">
          <SubmitButton size="app">Trocar senha</SubmitButton>
        </div>
      </form>
    </>
  );
}
