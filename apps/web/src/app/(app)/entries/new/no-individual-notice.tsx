'use client';

import { ArrowRightLeft } from 'lucide-react';

import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { useContextSelector } from '../../../_shell/context-selector';

/**
 * O novo lançamento num contexto sem nenhuma pessoa física ativa, como o de uma empresa: os lançamentos
 * dela entram com a clínica, então a tela diz o motivo e abre o seletor de contexto, no lugar do
 * formulário.
 */
export function NoIndividualNotice() {
  const contextSelector = useContextSelector();
  return (
    <section
      aria-labelledby="new-title"
      className="flex flex-col items-start gap-3 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <h2 id="new-title" className="text-heading-md text-ink">
        Novo lançamento
      </h2>
      <p>O contexto escolhido não tem nenhuma pessoa física ativa.</p>
      <p className="text-body-sm text-mute">
        Os lançamentos são das pessoas físicas; os de uma empresa entram com a clínica. Troque o contexto para um que
        tenha a pessoa física do lançamento.
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
