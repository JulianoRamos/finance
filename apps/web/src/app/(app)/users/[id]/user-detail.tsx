'use client';

import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';

import type { AccessLevel, User } from '@/api/users';

import { ErrorNotice } from '../../../_access/fields';
import { GHOST_DESTRUCTIVE_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../../_shell/buttons';
import { PANEL } from '../../../_shell/app-shell';
import { ConfirmDialog, useConfirmedCommand } from '../../../_shell/confirm-dialog';
import type { ListPage } from '../../../_shell/list-page';
import { generateRecoveryLinkAction, saveAccessAction, setUserActiveAction } from '../actions';
import { ManagesAccessField } from '../manages-access-field';
import { PermissionTable } from '../permission-table';
import { firstName, RecoveryLinkPanel } from '../recovery-link-panel';
import type { PermissionRow } from '../user-list-page';

/**
 * O botão de desativar o usuário, que pede a confirmação, ou de reativá-lo, no mesmo lugar, que vale na
 * hora: reativar não encerra nada.
 */
function ActivationButton({ user }: Readonly<{ user: User }>) {
  const { message, pending, run, confirming, setConfirming } = useConfirmedCommand(setUserActiveAction, {
    id: user.id,
    active: !user.active,
    version: user.version,
  });
  return (
    <>
      {message && <ErrorNotice>{message}</ErrorNotice>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (user.active) setConfirming(true);
          else run();
        }}
        className={GHOST_DESTRUCTIVE_BUTTON}
      >
        {user.active ? 'Desativar usuário' : 'Reativar usuário'}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Desativar ${user.name}?`}
        description="Ele deixa de entrar, e as sessões dele são encerradas na hora. O histórico e as permissões ficam guardados, e dá para reativar depois."
        confirmLabel="Desativar usuário"
        onConfirm={run}
      />
    </>
  );
}

/**
 * O detalhe do usuário (protótipo Usuarios, modo `detalhe`): o nome e o e-mail, o gerir acessos e a
 * tabela de permissões, que "Salvar permissões" grava juntos, com as escolhas de qualquer página da
 * tabela; o link de recuperação gerado, mostrado uma vez só; e a desativação.
 */
export function UserDetail({
  user,
  self,
  permissions,
}: Readonly<{ user: User; self: boolean; permissions: ListPage<PermissionRow> }>) {
  const [managesAccess, setManagesAccess] = useState(user.managesAccess);
  const [changes, setChanges] = useState<ReadonlyMap<string, AccessLevel>>(new Map());
  const [saved, save, saving] = useActionState(saveAccessAction, { message: null });
  const [generated, generate, generating] = useActionState(generateRecoveryLinkAction, { message: null, link: null });

  const choose = (row: PermissionRow, level: AccessLevel) => {
    const next = new Map(changes);
    // A escolha que volta ao nível lido não muda nada, e não vai na gravação.
    if (level === row.level) next.delete(row.entityId);
    else next.set(row.entityId, level);
    setChanges(next);
  };

  return (
    <section aria-labelledby="user-title" className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="user-title" className="text-heading-md wrap-anywhere text-ink">
              {user.name}
            </h2>
            {!user.active && (
              <span className="rounded-full bg-surface-subtle px-2 text-body-sm font-medium text-body">Desativado</span>
            )}
            {user.active && !user.passwordSet && (
              <span className="rounded-full bg-warning-soft px-2 text-body-sm font-medium text-warning">
                Senha não definida
              </span>
            )}
          </div>
          <span className="wrap-anywhere">{user.email}</span>
        </div>
        <Link href={`/users/${user.id}/edit`} className={SECONDARY_BUTTON}>
          Editar dados
        </Link>
      </div>
      <ManagesAccessField
        checked={managesAccess}
        onChange={setManagesAccess}
        // Quem gere acessos não tira de si mesmo o gerir acessos (regra 6.1).
        disabledNote={self ? 'Você não pode tirar de si mesmo o gerir acessos.' : null}
      />
      <PermissionTable
        userId={user.id}
        initial={permissions}
        idPrefix="detail"
        levelOf={(row) => changes.get(row.entityId) ?? row.level}
        onChoose={choose}
      />
      {generated.link && (
        <RecoveryLinkPanel
          title="Link de recuperação gerado"
          text={`Envie para ${firstName(user.name)} por um canal seguro. Vale até ${generated.link.expiresAt} e uma vez só. Usá-lo encerra todas as sessões dele.`}
          fieldLabel="Link de recuperação"
          url={generated.link.url}
          tone="neutral"
        />
      )}
      {saved.message && <ErrorNotice>{saved.message}</ErrorNotice>}
      {generated.message && <ErrorNotice>{generated.message}</ErrorNotice>}
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-hairline pt-4">
        <div className="flex flex-wrap items-start gap-2">
          {!self && <ActivationButton user={user} />}
          <button
            type="button"
            disabled={generating || !user.active}
            onClick={() => {
              startTransition(() => {
                generate({ id: user.id });
              });
            }}
            className={`${SECONDARY_BUTTON} disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface`}
          >
            Gerar link de recuperação
          </button>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            startTransition(() => {
              save({
                id: user.id,
                version: user.version,
                managesAccess,
                permissions: [...changes].map(([entityId, level]) => ({ entityId, level })),
              });
            });
          }}
          className={PRIMARY_BUTTON}
        >
          Salvar permissões
        </button>
      </div>
    </section>
  );
}
