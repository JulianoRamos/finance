'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { User } from '@/api/users';

import { EmailField, ErrorNotice, SubmitButton, TextField } from '../../_access/fields';
import { PANEL } from '../../_shell/app-shell';
import { SECONDARY_BUTTON } from '../../_shell/buttons';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import { updateUserAction, type UserEditFormState } from './actions';

/**
 * A edição do usuário (protótipo Usuarios, modo `editar`): o nome e o e-mail, que é o login. Trocar o
 * e-mail encerra as sessões dele (regra 6.1). Depois de uma recusa, os campos voltam ao que foi enviado.
 */
export function UserEditForm({ user }: Readonly<{ user: User }>) {
  const [state, action] = useActionState<UserEditFormState, FormData>(updateUserAction, INITIAL_FORM_STATE);
  const values = state.values ?? { name: user.name, email: user.email, managesAccess: user.managesAccess };

  return (
    <form action={action} aria-labelledby="edit-title" className={PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id="edit-title" className="text-heading-md text-ink">
          Editar dados
        </h2>
        <p className="wrap-anywhere">{user.name}</p>
      </div>
      {state.message && (
        <ErrorNotice>
          <span className="flex flex-wrap items-center gap-3">
            {state.message}
            {state.conflict && (
              // Um link comum, e não o do Next, para o usuário ser pedido de novo ao servidor.
              <a href={`/users/${user.id}/edit`} className={SECONDARY_BUTTON}>
                Recarregar o usuário
              </a>
            )}
          </span>
        </ErrorNotice>
      )}
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="version" value={user.version} />
      <TextField
        id="user-name"
        name="name"
        label="Nome"
        autoComplete="off"
        size="app"
        required={false}
        defaultValue={values.name}
        error={state.fields.name}
      />
      <EmailField
        id="user-email"
        name="email"
        label="E-mail"
        autoComplete="off"
        size="app"
        required={false}
        defaultValue={values.email}
        help="É o e-mail com que ele entra. Ao trocar, as sessões dele são encerradas e o próximo acesso usa o novo."
        error={state.fields.email}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
        <Link href={`/users/${user.id}`} className={SECONDARY_BUTTON}>
          Cancelar
        </Link>
        <SubmitButton size="app">Salvar alterações</SubmitButton>
      </div>
    </form>
  );
}
