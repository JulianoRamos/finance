'use client';

import { AlertDialog } from 'radix-ui';
import { type ReactNode, startTransition, useActionState, useRef, useState } from 'react';

import { DESTRUCTIVE_BUTTON, SECONDARY_BUTTON } from './buttons';
import { DIALOG_OVERLAY, DIALOG_SHEET, SHEET_HANDLE } from './dialog';

/**
 * A confirmação de uma ação que esconde ou tira algo (design-system.md, seção 4.5): o diálogo diz o que
 * vai acontecer e o que não se perde, e o botão repete a ação. Fecha com Esc e com "Cancelar", e devolve
 * o foco a quem o abriu. No celular, vira uma folha que sobe do rodapé, com os botões na largura toda
 * (seção 6).
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
  // As telas abrem a confirmação pelo estado, sem o gatilho do Radix, que é quem guardaria a quem
  // devolver o foco: o diálogo guarda o elemento focado ao abrir, antes de o Radix mover o foco.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={DIALOG_OVERLAY} />
        <AlertDialog.Content
          className={`${DIALOG_SHEET} flex flex-col gap-4`}
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnFocusRef.current;
            returnFocusRef.current = null;
            // Fora da página, o foco fica com o navegador.
            if (target?.isConnected) returnFocus(target);
          }}
        >
          <div aria-hidden="true" className={SHEET_HANDLE} />
          <AlertDialog.Title className="text-heading-md wrap-anywhere text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body-md text-body">{description}</AlertDialog.Description>
          {children}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:flex-wrap md:justify-end md:gap-3">
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

/**
 * Devolve o foco ao elemento. Depois de confirmar, o botão que abriu a confirmação fica desabilitado
 * enquanto a ação roda, e um elemento desabilitado não recebe o foco: espera ele voltar a valer, e só
 * então o foca, se ninguém tiver levado o foco para outro lugar nesse meio-tempo.
 */
export function returnFocus(target: HTMLElement) {
  if (!target.matches(':disabled')) {
    target.focus();
    return;
  }
  const observer = new MutationObserver(() => {
    if (target.matches(':disabled')) return;
    observer.disconnect();
    if (target.isConnected && (document.activeElement === null || document.activeElement === document.body)) {
      target.focus();
    }
  });
  observer.observe(target, { attributes: true, attributeFilter: ['disabled'] });
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
