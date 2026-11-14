'use client';

import { Ellipsis, LogOut } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';

import { GHOST_ICON_BUTTON } from '../../_shell/buttons';
import { useConfirmedCommand } from '../../_shell/confirm-dialog';
import { Hint } from '../../_shell/hint';
import { MENU_ITEM_DESTRUCTIVE, MENU_PANEL } from '../../_shell/menu';
import { endSessionAction } from './actions';

/** O tamanho do botão "mais": 28px na tabela e 44px de área de toque na lista do celular (design-system.md, seção 4.2). */
const SIZE = { table: 'size-7', list: 'size-11' } as const;

/**
 * O menu de ações de uma sessão (design-system.md, seção 4.4): o botão de ícone "mais" (⋯) fantasma, com
 * o nome acessível "Ações da sessão <aparelho>", e o item "Encerrar sessão", em `negative`, que encerra
 * na hora, sem confirmação: a sessão encerrada não perde dado, e o usuário entra de novo.
 */
export function SessionActions({
  id,
  device,
  size,
}: Readonly<{ id: string; device: string; size: keyof typeof SIZE }>) {
  const label = `Ações da sessão ${device}`;
  // Sem confirmação: a sessão encerrada não perde dado, e o usuário entra de novo.
  const { message, pending, run } = useConfirmedCommand(endSessionAction, { id });
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <DropdownMenu.Root modal={false}>
        <Hint label={label} expanded={false} side="bottom">
          <DropdownMenu.Trigger
            aria-label={label}
            className={`inline-flex ${SIZE[size]} ${GHOST_ICON_BUTTON} align-middle aria-expanded:bg-surface-subtle`}
          >
            <Ellipsis size={16} strokeWidth={1.5} aria-hidden="true" />
          </DropdownMenu.Trigger>
        </Hint>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4} className={MENU_PANEL}>
            <DropdownMenu.Item className={MENU_ITEM_DESTRUCTIVE} disabled={pending} onSelect={run}>
              <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
              Encerrar sessão
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {message && (
        <span role="alert" className="text-body-sm whitespace-normal text-negative">
          {message}
        </span>
      )}
    </span>
  );
}
