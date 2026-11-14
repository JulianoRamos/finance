'use client';

import { useState } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { SECONDARY_BUTTON } from '../../_shell/buttons';

/**
 * O painel do link de recuperação, mostrado uma vez só (regra 6.1): o título, o texto com o prazo, o
 * link inteiro num campo só de leitura e o botão de copiar.
 */
export function RecoveryLinkPanel({
  title,
  text,
  fieldLabel,
  url,
  tone,
}: Readonly<{
  title: string;
  text: string;
  fieldLabel: string;
  url: string;
  /** O destaque do cadastro recém-feito, ou o painel neutro do link gerado no detalhe. */
  tone: 'accent' | 'neutral';
}>) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-md border p-4 ${tone === 'accent' ? 'border-accent bg-accent-soft' : 'border-hairline'}`}
    >
      <span className="text-label text-ink">{title}</span>
      <span className="text-body">{text}</span>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label={fieldLabel}
          readOnly
          value={url}
          onFocus={(event) => {
            event.target.select();
          }}
          className={`h-10 w-full min-w-0 rounded-sm sm:w-auto sm:flex-1 border border-hairline bg-surface-subtle px-3 font-mono text-body-md text-ink md:h-9 ${FOCUS_RING}`}
        />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
            });
          }}
          className={SECONDARY_BUTTON}
        >
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  );
}

/** O primeiro nome, com que os textos do link falam do usuário. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
