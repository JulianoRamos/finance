import type { FinancialGroup } from '@/api/financial-groups';

const NAMES = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' });

/** Quantas pessoas físicas, por extenso: "Nenhuma pessoa física", "1 pessoa física", "2 pessoas físicas". */
function individualsText(count: number): string {
  if (count === 0) return 'Nenhuma pessoa física';
  return count === 1 ? '1 pessoa física' : `${String(count)} pessoas físicas`;
}

/**
 * A segunda linha do grupo na lista: na Visão Familiar, a contagem das pessoas físicas e quem a criou;
 * num grupo do usuário, os nomes dos membros ("Ana Lima e Clínica Exemplo"), ou "Sem membros".
 */
export function groupSummary(group: FinancialGroup): string {
  // A Visão Familiar só tem pessoas físicas (regra 6.2): a api garante, e a tela só conta.
  if (group.isFamilyView) return `${individualsText(group.members.length)} · criado pelo sistema`;
  if (group.members.length === 0) return 'Sem membros';
  return NAMES.format(group.members.map((member) => member.name));
}
