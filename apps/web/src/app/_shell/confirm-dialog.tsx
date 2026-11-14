'use client';

import { AlertDialog } from 'radix-ui';
import { type ReactNode, startTransition, useActionState, useState } from 'react';

import { DESTRUCTIVE_BUTTON, SECONDARY_BUTTON } from './buttons';

/**
 * A confirmação de uma ação que esconde ou tira algo (design-system.md, seção 4.5): o diálogo diz o que
 * vai acontecer e o que não se perde, e o botão repete a ação. Fecha com Esc e com "Cancelar", e devolve
 * o foco a quem o abriu.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** O que vai acontecer, que o leitor de tela anuncia com o título. */
  description: string;
  /** O que mais a confirmação precisa dizer, abaixo da descrição. */
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}>) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-full max-w-section -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-hairline bg-surface p-6 shadow-flutuante">
          <AlertDialog.Title className="text-heading-md wrap-anywhere text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body-md text-body">{description}</AlertDialog.Description>
          {children}
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel className={SECONDARY_BUTTON}>Cancelar</AlertDialog.Cancel>
            <AlertDialog.Action className={DESTRUCTIVE_BUTTON} onClick={onConfirm}>
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** O que um comando sem formulário devolve à tela: a recusa, se houve. */
export interface CommandMessage {
  readonly message: string | null;
}

/**
 * Um comando que um controle sem formulário dispara, como um botão ou uma chave: a ação do servidor
 * com o argumento dado, o envio em andamento, a recusa e o estado da confirmação, para o controle
 * que pede confirmar antes.
 */
export function useConfirmedCommand<Payload>(
  action: (previous: CommandMessage, payload: Payload) => Promise<CommandMessage>,
  payload: Payload,
) {
  const [state, dispatch, pending] = useActionState(action, { message: null });
  const [confirming, setConfirming] = useState(false);
  function run() {
    startTransition(() => {
      dispatch(payload);
    });
  }
  return { message: state.message, pending, run, confirming, setConfirming };
}
