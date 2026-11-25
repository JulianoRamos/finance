'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { type ReactElement, type ReactNode, useRef } from 'react';

import { GHOST_ICON_BUTTON, SECONDARY_BUTTON } from './buttons';
import { returnFocus } from './confirm-dialog';
import { DIALOG_OVERLAY, DIALOG_SHEET, SHEET_HANDLE } from './dialog';
import { Hint } from './hint';

/**
 * O diálogo de um formulário curto sobre o detalhe, como a nova movimentação (design-system.md, seção
 * 4.5): fundo `surface`, raio `radius-lg`, até 560px, sobre a página escurecida. Fecha com Esc, com o
 * botão de fechar e com o "Cancelar" do formulário, e devolve o foco ao botão que o abriu. No celular,
 * vira uma folha que sobe do rodapé. O formulário vai em `children`, com as ações no fim. Sem o gatilho,
 * como o diálogo aberto por um item de menu, ele devolve o foco a quem estava com ele ao abrir.
 */
export function FormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O botão que abre o diálogo, e que recebe o foco de volta; sem ele, a tela abre o diálogo pelo estado. */
  trigger?: ReactElement;
  title: string;
  /** A frase de apoio, abaixo do título, que o leitor de tela lê como a descrição do diálogo. */
  description?: string;
  children: ReactNode;
}>) {
  // Sem o gatilho do Radix, que é quem guardaria a quem devolver o foco, o diálogo o guarda ao abrir.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY} />
        <Dialog.Content
          // Sem a frase de apoio, o título basta: o formulário fala por si. Com ela, o Radix liga a descrição.
          {...(description === undefined && { 'aria-describedby': undefined })}
          onOpenAutoFocus={(event) => {
            if (!trigger) {
              returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }
            // O foco vai para o primeiro campo, e não para o botão de fechar, que abriria a dica dele.
            const field = event.currentTarget instanceof HTMLElement && firstField(event.currentTarget);
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            if (trigger) return;
            event.preventDefault();
            const target = returnFocusRef.current;
            returnFocusRef.current = null;
            if (target?.isConnected) returnFocus(target);
          }}
          className={`${DIALOG_SHEET} flex max-h-full flex-col gap-4 overflow-y-auto`}
        >
          <div aria-hidden="true" className={SHEET_HANDLE} />
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="min-w-0 text-heading-md wrap-anywhere text-ink">{title}</Dialog.Title>
            <Hint label="Fechar" expanded={false} side="bottom">
              <Dialog.Close aria-label="Fechar" className={`${GHOST_ICON_BUTTON} inline-flex size-8`}>
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </Dialog.Close>
            </Hint>
          </div>
          {description !== undefined && (
            <Dialog.Description className="text-body-md wrap-anywhere text-body">{description}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** O "Cancelar" das ações do formulário do diálogo, que o fecha sem enviar. */
export function FormDialogCancel() {
  return <Dialog.Close className={SECONDARY_BUTTON}>Cancelar</Dialog.Close>;
}

/** O primeiro campo do formulário: num grupo de rádios, o marcado, que é o que o Tab alcança. */
function firstField(content: HTMLElement): HTMLElement | null {
  return content.querySelector<HTMLElement>(
    'form input[type="radio"]:checked, form input:not([type="hidden"]):not([type="radio"]), form select, form textarea',
  );
}
