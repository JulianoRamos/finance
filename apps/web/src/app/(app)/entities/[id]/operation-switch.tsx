'use client';

import { Switch } from 'radix-ui';

import { FOCUS_RING } from '../../../_access/access-screen';
import { ErrorNotice } from '../../../_access/fields';
import { setClinicAction } from '../actions';
import { ConfirmDialog, useConfirmedCommand } from '../../../_shell/confirm-dialog';

/**
 * A chave da operação de clínica (design-system.md, seção 4.3): ligar vale na hora; desligar pede a
 * confirmação, que diz o que sai e o que não se apaga (seção 4.5).
 */
export function OperationSwitch({
  entityId,
  entityName,
  enabled,
}: Readonly<{ entityId: string; entityName: string; enabled: boolean }>) {
  const { message, pending, run, confirming, setConfirming } = useConfirmedCommand(setClinicAction, {
    id: entityId,
    enabled: !enabled,
  });

  return (
    <div className="flex flex-col gap-3">
      {message && <ErrorNotice>{message}</ErrorNotice>}
      <div className="flex items-start justify-between gap-4 rounded-md border border-hairline p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="operation-clinic" className="text-label text-ink">
            Clínica
          </label>
          <span id="operation-clinic-description" className="text-body-sm text-mute">
            Clientes, procedimentos, atendimentos, pacotes, estoque e compras.
          </span>
        </div>
        <Switch.Root
          id="operation-clinic"
          checked={enabled}
          disabled={pending}
          aria-describedby="operation-clinic-description"
          onCheckedChange={(checked) => {
            if (checked) run();
            else setConfirming(true);
          }}
          className={`mt-1 inline-flex h-4 w-8 flex-none cursor-pointer items-center rounded-full bg-faint data-[state=checked]:bg-accent disabled:cursor-wait ${FOCUS_RING}`}
        >
          <Switch.Thumb className="size-4 rounded-full border border-hairline-strong bg-surface transition-transform data-[state=checked]:translate-x-4" />
        </Switch.Root>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Desligar a operação Clínica na ${entityName}?`}
        description="Clientes, atendimentos, pacotes, estoque e compras saem da navegação desta empresa, e nada novo de clínica pode ser registrado nela. Nada é apagado: ao religar, tudo volta como estava."
        confirmLabel="Desligar operação"
        onConfirm={run}
      >
        <p className="text-body-sm text-mute">
          As receitas e as despesas que a clínica já gerou continuam nos números da empresa, mas só podem ser alteradas
          com a operação ligada.
        </p>
      </ConfirmDialog>
    </div>
  );
}
