'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';

import type { AccessLevel } from '@/api/users';

import { EmailField, ErrorNotice, SubmitButton, TextField } from '../../_access/fields';
import { PANEL } from '../../_shell/app-shell';
import { SECONDARY_BUTTON } from '../../_shell/buttons';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import type { ListPage } from '../../_shell/list-page';
import { createUserAction, type NewUserFormState } from './actions';
import { useCreatedUser } from './created-user';
import { ManagesAccessField } from './manages-access-field';
import { PermissionTable } from './permission-table';
import { firstName, RecoveryLinkPanel } from './recovery-link-panel';
import type { PermissionRow } from './user-list-page';

const INITIAL_STATE: NewUserFormState = { ...INITIAL_FORM_STATE, created: null };

/** Uma escolha da tabela: o nível e o nome da entidade, para o resumo depois de criar. */
interface Choice {
  readonly level: AccessLevel;
  readonly name: string;
}

/** Os nomes numa frase: "A", "A e B", "A, B e C". */
function joined(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names.at(-1) ?? ''}`;
}

/** O resumo das permissões dadas no cadastro: "operar em A; ver em B", ou nenhuma. */
function permissionsSummary(choices: ReadonlyMap<string, Choice>): string {
  const named = (level: AccessLevel) =>
    joined([...choices.values()].filter((choice) => choice.level === level).map((choice) => choice.name));
  const [operate, view] = [named('operate'), named('view')];
  const parts = [operate && `operar em ${operate}`, view && `ver em ${view}`].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : 'sem acesso a nenhuma entidade';
}

/**
 * O cadastro (protótipo Usuarios, modo `novo`): o nome, o e-mail, o gerir acessos e as permissões por
 * entidade, de qualquer página da tabela. Criado, o formulário dá lugar ao usuário e ao link para ele
 * definir a senha (modo `criado`), mostrado uma vez só.
 */
export function NewUserForm({ listedBy, entities }: Readonly<{ listedBy: string; entities: ListPage<PermissionRow> }>) {
  const [state, action] = useActionState(createUserAction, INITIAL_STATE);
  const [managesAccess, setManagesAccess] = useState(false);
  const [choices, setChoices] = useState<ReadonlyMap<string, Choice>>(new Map());
  const { set: setCreated } = useCreatedUser();
  const createdId = state.created?.user.id ?? null;

  // A lista marca o usuário criado no lugar do item "Novo usuário"; ao sair do cadastro, ela volta ao normal.
  useEffect(() => {
    setCreated(createdId);
    return () => {
      setCreated(null);
    };
  }, [createdId, setCreated]);

  if (state.created) {
    const { user, link } = state.created;
    const first = firstName(user.name);
    return (
      <section aria-labelledby="created-title" className={PANEL}>
        <div className="flex flex-col gap-1">
          <h2 id="created-title" className="text-heading-md wrap-anywhere text-ink">
            {user.name}
          </h2>
          <span className="wrap-anywhere">{user.email}</span>
        </div>
        <RecoveryLinkPanel
          title="Usuário criado. Falta a senha"
          text={`Envie este link para ${first} por um canal seguro. Com ele, ${first} define a senha e entra. Vale até ${link.expiresAt} e uma vez só.`}
          fieldLabel="Link para definir a senha"
          url={link.url}
          tone="accent"
        />
        <p className="text-body-sm text-mute">
          {`Permissões: ${permissionsSummary(choices)}. Até definir a senha, ${first} aparece na lista com o selo "Senha não definida".`}
        </p>
      </section>
    );
  }

  const values = state.values ?? { name: '', email: '', managesAccess: false };
  const choose = (row: PermissionRow, level: AccessLevel) => {
    const next = new Map(choices);
    if (level === 'none') next.delete(row.entityId);
    else next.set(row.entityId, { level, name: row.name });
    setChoices(next);
  };

  return (
    <form action={action} aria-labelledby="new-title" className={PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id="new-title" className="text-heading-md text-ink">
          Novo usuário
        </h2>
        <p>Ao criar, o sistema gera um link para a pessoa definir a senha.</p>
      </div>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="new-user-name"
          name="name"
          label="Nome"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={values.name}
          error={state.fields.name}
        />
        <EmailField
          id="new-user-email"
          name="email"
          label="E-mail"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={values.email}
          error={state.fields.email}
        />
      </div>
      <ManagesAccessField name="managesAccess" checked={managesAccess} onChange={setManagesAccess} />
      <input
        type="hidden"
        name="permissions"
        value={JSON.stringify([...choices].map(([entityId, { level }]) => ({ entityId, level })))}
      />
      <PermissionTable
        userId={listedBy}
        initial={entities}
        idPrefix="new"
        // O usuário novo começa sem acesso: o nível lido é o de quem cadastra, e não vale aqui.
        levelOf={(row) => choices.get(row.entityId)?.level ?? 'none'}
        onChoose={choose}
      />
      <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
        <Link href="/users" className={SECONDARY_BUTTON}>
          Cancelar
        </Link>
        <SubmitButton size="app">Criar e gerar link</SubmitButton>
      </div>
    </form>
  );
}
