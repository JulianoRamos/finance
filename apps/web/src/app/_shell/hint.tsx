'use client';

import { Tooltip } from 'radix-ui';
import { type ReactNode, useState, useSyncExternalStore } from 'react';

/** A partir de 768px (`md`). */
const MD_UP = '(min-width: 48rem)';

function subscribeToMdUp(onChange: () => void): () => void {
  const query = window.matchMedia(MD_UP);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Se a tela tem 768px ou mais; no servidor, que não sabe, não. */
function useMdUp(): boolean {
  return useSyncExternalStore(
    subscribeToMdUp,
    () => window.matchMedia(MD_UP).matches,
    () => false,
  );
}

/**
 * A dica com o nome de um botão de ícone ou de um item da barra lateral recolhida (design-system.md,
 * seções 4.1 e 4.2). Com a barra aberta no desktop, o nome do item já está escrito, e a dica dele só
 * aparece abaixo de 1024px; um botão de ícone passa `expanded` falso, e a dica aparece sempre. Ela fica
 * por cima de tudo, também do painel lateral e dos diálogos.
 */
export function Hint({
  label,
  expanded,
  side = 'right',
  hiddenFromMd = false,
  children,
}: Readonly<{
  label: string;
  expanded: boolean;
  side?: 'right' | 'bottom';
  /**
   * Não abre a partir de 768px, onde o controle mostra o nome escrito, como o campo da pesquisa: nem aparece
   * nem descreve o controle para o leitor de tela, que já ouve o nome.
   */
  hiddenFromMd?: boolean;
  children: ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const suppressed = useMdUp() && hiddenFromMd;
  return (
    <Tooltip.Root open={open && !suppressed} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className={`z-60 rounded-sm bg-ink px-2 py-1 text-body-sm text-on-primary ${expanded ? 'lg:hidden' : ''}`}
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
