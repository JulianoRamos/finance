'use client';

import { Check } from 'lucide-react';
import { useEffect } from 'react';

/** Quanto o aviso temporário fica na tela (design-system.md, seção 4.5). */
const NOTICE_MS = 5000;

/**
 * O aviso temporário de um comando aceito (design-system.md, seção 4.5): no canto inferior direito (no
 * topo, no celular), some em 5 segundos e é anunciado pela região `status`, que fica sempre na página
 * para o leitor de tela ouvir o texto novo. Sem texto, só a região.
 */
export function TemporaryNotice({ text, onGone }: Readonly<{ text: string | null; onGone: () => void }>) {
  useEffect(() => {
    if (text === null) return undefined;
    const timer = setTimeout(onGone, NOTICE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, onGone]);
  return (
    <div role="status" aria-live="polite">
      {text !== null && (
        <div className="fixed inset-x-4 top-4 z-50 flex items-start gap-3 rounded-md border border-hairline bg-surface px-4 py-3 text-ink shadow-flutuante md:inset-x-auto md:top-auto md:right-6 md:bottom-6 md:w-menu-list">
          <Check size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 flex-none text-positive" />
          <span className="flex-1">{text}</span>
        </div>
      )}
    </div>
  );
}
