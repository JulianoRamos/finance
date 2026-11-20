'use client';

import { ErrorNotice } from '../../../_access/fields';
import { GHOST_BUTTON } from '../../../_shell/buttons';
import { ConfirmDialog, useConfirmedCommand } from '../../../_shell/confirm-dialog';
import { setAccountActiveAction } from '../actions';

/**
 * O botão de desativar a conta, que pede a confirmação, ou de reativá-la, que vale na hora: reativar só a
 * devolve às escolhas de conta.
 */
export function ActivationForm({
  accountId,
  accountName,
  version,
  active,
}: Readonly<{ accountId: string; accountName: string; version: number; active: boolean }>) {
  const { message, pending, run, confirming, setConfirming } = useConfirmedCommand(setAccountActiveAction, {
    id: accountId,
    active: !active,
    version,
  });

  return (
    <div className="flex flex-col gap-3">
      {message && <ErrorNotice>{message}</ErrorNotice>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (active) setConfirming(true);
          else run();
        }}
        className={GHOST_BUTTON}
      >
        {active ? 'Desativar conta' : 'Reativar conta'}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Desativar a conta ${accountName}?`}
        description="A conta sai das escolhas de conta. Nada é apagado: as movimentações e o saldo continuam nos números, e ela pode ser reativada."
        confirmLabel="Desativar conta"
        onConfirm={run}
      />
    </div>
  );
}
