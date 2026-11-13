'use client';

import Link from 'next/link';
import { type ReactNode, useActionState, useState } from 'react';

import type { FinancialGroup, FinancialGroupMember } from '@/api/financial-groups';

import { ErrorNotice, FieldError, SubmitButton, TextField } from '../../_access/fields';
import { GHOST_DESTRUCTIVE_BUTTON, SECONDARY_BUTTON } from '../../_shell/buttons';
import { ConfirmDialog, useConfirmedCommand } from '../../_shell/confirm-dialog';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import { TYPE_BADGES } from '../entities/tax-id-format';
import { createGroupAction, deleteGroupAction, type GroupFormState, updateGroupAction } from './actions';

/**
 * Uma entidade que o formulário oferece como membro, com o que a resposta do grupo traz de cada uma.
 */
export type MemberOption = FinancialGroupMember;

const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';
const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-hairline px-3 py-2';
const CONTROL = 'size-4 flex-none accent-accent';
const BADGE = 'ml-auto flex-none rounded-full px-2 text-body-sm font-medium';
const BLOCKED_NOTE = 'Empresa: não entra na Visão Familiar';

/** O selo do membro: o tipo (PF ou PJ), ou "Desativada" na entidade desativada que já estava no grupo. */
function MemberBadge({ option }: Readonly<{ option: MemberOption }>) {
  if (!option.active) return <span className={`${BADGE} bg-surface-subtle text-body`}>Desativada</span>;
  return <span className={`${BADGE} bg-accent-soft text-link`}>{TYPE_BADGES[option.type]}</span>;
}

/**
 * Os membros, um por linha. Na Visão Familiar, a empresa aparece com a caixa desabilitada e o motivo,
 * porque ela só aceita pessoas físicas (regra 6.2).
 */
function MemberChoices({
  options,
  checked,
  familyView,
  error,
  hint,
}: Readonly<{
  options: readonly MemberOption[];
  checked: ReadonlySet<string>;
  familyView: boolean;
  error: string | undefined;
  hint?: ReactNode;
}>) {
  return (
    <fieldset aria-describedby={error ? 'members-error' : undefined} className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-ink">Membros</legend>
      {options.length === 0 && <p className="text-body-sm text-mute">Nenhuma entidade ativa para escolher.</p>}
      {options.map((option) => {
        const blocked = familyView && option.type === 'company';
        const noteId = `member-${option.id}-note`;
        return (
          <div key={option.id} className={`${ROW} ${blocked ? 'text-mute' : 'text-ink'}`}>
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <input
                type="checkbox"
                name="memberIds"
                value={option.id}
                defaultChecked={!blocked && checked.has(option.id)}
                disabled={blocked}
                aria-describedby={blocked ? noteId : undefined}
                className={CONTROL}
              />
              <span className="min-w-0 wrap-anywhere">{option.name}</span>
              {!blocked && <MemberBadge option={option} />}
            </label>
            {blocked && (
              <span id={noteId} className="ml-auto text-body-sm text-mute">
                {BLOCKED_NOTE}
              </span>
            )}
          </div>
        );
      })}
      {hint}
      <FieldError id="members-error" error={error} />
    </fieldset>
  );
}

/** O botão de excluir o grupo, à esquerda do rodapé, que pede a confirmação. */
function DeleteGroup({ group }: Readonly<{ group: FinancialGroup }>) {
  const { message, pending, run, confirming, setConfirming } = useConfirmedCommand(deleteGroupAction, {
    id: group.id,
  });
  return (
    <div className="flex flex-col gap-3">
      {message && <ErrorNotice>{message}</ErrorNotice>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setConfirming(true);
        }}
        className={GHOST_DESTRUCTIVE_BUTTON}
      >
        Excluir grupo
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Excluir o grupo ${group.name}?`}
        description="As entidades e os números delas não mudam: só o agrupamento some do seletor de contexto. Quem estiver usando este contexto volta para a Visão Familiar."
        confirmLabel="Excluir grupo"
        onConfirm={run}
      />
    </div>
  );
}

/** O título e o texto abaixo dele, de cada modo do formulário. */
function headingOf(group: FinancialGroup | undefined, createdOn: string): { title: string; text: string } {
  if (!group) {
    return {
      title: 'Novo grupo financeiro',
      text: 'Junta entidades para ver os números delas somados num contexto só.',
    };
  }
  if (group.isFamilyView) {
    return {
      title: group.name,
      text: 'Só aceita pessoas físicas. As empresas aparecem nela pelos repasses e pela participação societária. Ela não é renomeada nem excluída.',
    };
  }
  return { title: group.name, text: `Grupo criado em ${createdOn}` };
}

/**
 * O formulário de um grupo, no lugar do Conteúdo: na Visão Familiar, só os membros, com o nome fixo
 * (regra 6.2); num grupo do usuário, o nome, os membros e a exclusão; e o de um novo grupo, que começa
 * sem nenhuma entidade marcada. Depois de uma recusa, os campos voltam ao que foi enviado; "Descartar"
 * os volta ao que foi lido.
 */
export function GroupForm({
  group,
  createdOn = '',
  options,
}: Readonly<{
  group?: FinancialGroup;
  /**
   * O dia da criação do grupo, já formatado no servidor, no fuso do processo da web: formatado aqui, a
   * hidratação usaria o fuso do navegador, e o dia poderia mudar.
   */
  createdOn?: string;
  options: readonly MemberOption[];
}>) {
  const [state, action] = useActionState<GroupFormState, FormData>(
    group ? updateGroupAction : createGroupAction,
    INITIAL_FORM_STATE,
  );
  // O estado descartado: o formulário volta ao que foi lido, sem a recusa, até o próximo envio.
  const [discarded, setDiscarded] = useState<GroupFormState>(INITIAL_FORM_STATE);
  const [resets, setResets] = useState(0);
  const shown = state === discarded ? INITIAL_FORM_STATE : state;
  const familyView = group?.isFamilyView ?? false;
  const values = shown.values ?? {
    name: group?.name ?? '',
    memberIds: group?.members.map((member) => member.id) ?? [],
  };
  const { title, text } = headingOf(group, createdOn);
  const titleId = 'group-title';

  const fields = (
    <form key={resets} action={action} aria-labelledby={familyView ? undefined : titleId} className={PANEL}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-heading-md wrap-anywhere text-ink">
          {title}
        </h2>
        <p>{text}</p>
      </div>
      {shown.message && (
        <ErrorNotice>
          <span className="flex flex-wrap items-center gap-3">
            {shown.message}
            {shown.conflict && group && (
              // Um link comum, e não o do Next, para o grupo ser pedido de novo ao servidor.
              <a href={`/financial-groups/${group.id}`} className={SECONDARY_BUTTON}>
                Recarregar o grupo
              </a>
            )}
          </span>
        </ErrorNotice>
      )}
      {group && (
        <>
          <input type="hidden" name="id" value={group.id} />
          <input type="hidden" name="version" value={group.version} />
        </>
      )}
      {familyView ? (
        <input type="hidden" name="name" value={values.name} />
      ) : (
        <TextField
          id="group-name"
          name="name"
          label="Nome"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={values.name}
          error={shown.fields.name}
          placeholder="Por exemplo, Tudo do Bruno"
        />
      )}
      <MemberChoices
        options={options}
        checked={new Set(values.memberIds)}
        familyView={familyView}
        error={shown.fields.memberIds}
        hint={
          group ? undefined : (
            <p className="text-body-sm text-mute">
              Pessoas físicas e empresas podem entrar juntas. Só a Visão Familiar se limita a pessoas físicas.
            </p>
          )
        }
      />
      <div
        className={`flex flex-wrap gap-3 border-t border-hairline pt-4 ${group && !familyView ? 'justify-between' : 'justify-end'}`}
      >
        {group && !familyView && <DeleteGroup group={group} />}
        <div className="flex flex-wrap gap-3">
          {group ? (
            <button
              type="button"
              onClick={() => {
                setDiscarded(state);
                setResets((count) => count + 1);
              }}
              className={SECONDARY_BUTTON}
            >
              Descartar
            </button>
          ) : (
            <Link href="/financial-groups" className={SECONDARY_BUTTON}>
              Cancelar
            </Link>
          )}
          <SubmitButton size="app">
            {group ? (familyView ? 'Salvar membros' : 'Salvar alterações') : 'Criar grupo'}
          </SubmitButton>
        </div>
      </div>
    </form>
  );

  // A Visão Familiar é uma seção com o título dela, como o detalhe do protótipo; o formulário vai dentro.
  return familyView ? <section aria-labelledby={titleId}>{fields}</section> : fields;
}
