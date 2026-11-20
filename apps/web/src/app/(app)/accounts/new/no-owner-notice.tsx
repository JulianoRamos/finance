'use client';

import { ArrowRightLeft } from 'lucide-react';

import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { useContextSelector } from '../../../_shell/context-selector';

/**
 * A nova conta num contexto sem nenhuma entidade ativa, como um grupo vazio: não há dona para escolher,
 * então a tela diz o motivo e abre o seletor de contexto, no lugar do formulário.
 */
export function NoOwnerNotice() {
  const contextSelector = useContextSelector();
  return (
    <section
      aria-labelledby="new-title"
      className="flex flex-col items-start gap-3 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <h2 id="new-title" className="text-heading-md text-ink">
        Nova conta
      </h2>
      <p>O contexto escolhido não tem nenhuma entidade ativa.</p>
      <p className="text-body-sm text-mute">
        A conta é de uma entidade do contexto. Troque o contexto para um que tenha a dona da conta.
      </p>
      <button
        type="button"
        className={SECONDARY_BUTTON}
        onClick={() => {
          contextSelector.setOpen(true);
        }}
      >
        <ArrowRightLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Trocar o contexto
      </button>
    </section>
  );
}
