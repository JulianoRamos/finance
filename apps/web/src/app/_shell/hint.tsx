'use client';

import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/**
 * A dica com o nome de um botão de ícone ou de um item da barra lateral recolhida (design-system.md,
 * seções 4.1 e 4.2). Com a barra aberta no desktop, o nome do item já está escrito, e a dica dele só
 * aparece abaixo de 1024px; um botão de ícone passa `expanded` falso, e a dica aparece sempre.
 */
export function Hint({
  label,
  expanded,
  side = 'right',
  children,
}: Readonly<{ label: string; expanded: boolean; side?: 'right' | 'bottom'; children: ReactNode }>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className={`z-30 rounded-sm bg-ink px-2 py-1 text-body-sm text-on-primary ${expanded ? 'lg:hidden' : ''}`}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** O provedor das dicas, uma vez na estrutura do app. */
export function HintProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>;
}
