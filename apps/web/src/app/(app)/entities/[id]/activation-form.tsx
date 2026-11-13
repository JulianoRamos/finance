'use client';

import { ErrorNotice } from '../../../_access/fields';
import { GHOST_BUTTON } from '../../../_shell/buttons';
import { ConfirmDialog, useConfirmedCommand } from '../../../_shell/confirm-dialog';
import { setActiveAction } from '../actions';

/**
 * O botão de desativar a entidade, que pede a confirmação, ou de reativá-la, que vale na hora: reativar
 * só a devolve às escolhas.
 */
export function ActivationForm({
  entityId,
  entityName,
  version,
  active,
}: Readonly<{ entityId: string; entityName: string; version: number; active: boolean }>) {
  const { message, pending, run, confirming, setConfirming } = useConfirmedCommand(setActiveAction, {
    id: entityId,
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
        {active ? 'Desativar entidade' : 'Reativar entidade'}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Desativar a ${entityName}?`}
        description="Ela sai das escolhas, como o seletor de contexto e os grupos, e nada novo pode ser registrado nela. Nada é apagado: ela continua nos registros e no histórico, e dá para reativá-la depois."
        confirmLabel="Desativar entidade"
        onConfirm={run}
      />
    </div>
  );
}
