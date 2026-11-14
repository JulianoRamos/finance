import type { EntityType } from '@/api/entities';

// O documento como a tela o mostra (design-system.md, seção 3): completo e formatado no cadastro, e o
// CPF mascarado nas listas. A api o devolve só com os caracteres.

/** O CPF ou o CNPJ com a pontuação: 529.982.247-25 ou 12.ABC.345/01DE-35. */
export function formatTaxId(type: EntityType, taxId: string): string {
  if (type === 'individual') {
    return `${taxId.slice(0, 3)}.${taxId.slice(3, 6)}.${taxId.slice(6, 9)}-${taxId.slice(9)}`;
  }
  return `${taxId.slice(0, 2)}.${taxId.slice(2, 5)}.${taxId.slice(5, 8)}/${taxId.slice(8, 12)}-${taxId.slice(12)}`;
}

/** O CPF mascarado, com só os algarismos do meio: ***.456.789-**. */
export function maskCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** O nome do tipo, como o detalhe o mostra. */
export const TYPE_NAMES: Readonly<Record<EntityType, string>> = {
  individual: 'Pessoa física',
  company: 'Pessoa jurídica',
};

/** A sigla do tipo, como o selo da lista a mostra. */
export const TYPE_BADGES: Readonly<Record<EntityType, string>> = { individual: 'PF', company: 'PJ' };
