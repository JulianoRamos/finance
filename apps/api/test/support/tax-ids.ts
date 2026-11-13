import { randomInt } from 'node:crypto';

// Documentos válidos e aleatórios para os testes: o documento é único no banco inteiro, e os testes
// dividem o finance_test.

/** O dígito verificador do módulo 11, com os pesos dados. */
function checkDigit(digits: readonly number[], weights: readonly number[]): number {
  const remainder = digits.reduce((sum, digit, index) => sum + digit * (weights[index] ?? 0), 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Um CPF válido, só com os algarismos, que nenhum outro teste usa. */
export function uniqueCpf(): string {
  const base = Array.from({ length: 9 }, () => randomInt(10));
  const first = checkDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit([...base, first], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, first, second].join('');
}

/** Um CNPJ numérico válido, só com os algarismos, que nenhum outro teste usa. */
export function uniqueCnpj(): string {
  const base = Array.from({ length: 12 }, () => randomInt(10));
  const first = checkDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit([...base, first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, first, second].join('');
}

/** O CNPJ com a pontuação, como o usuário o escreve: 00.000.000/0001-91. */
export function formatCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
