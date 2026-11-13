import type { EntityType } from '../../common/index.js';

// O documento da entidade (regra 6.2): o CPF na pessoa física e o CNPJ na jurídica, inclusive o
// alfanumérico, conferidos pelos dígitos verificadores, no módulo 11.

/** A pontuação e os espaços que o documento pode trazer. */
const PUNCTUATION = /[\s./-]/g;
const CPF_FORMAT = /^\d{11}$/;
/** Doze letras maiúsculas ou algarismos e dois dígitos verificadores, que são sempre algarismos. */
const CNPJ_FORMAT = /^[0-9A-Z]{12}\d{2}$/;

/** O documento só com os caracteres, com as letras em maiúsculas, ou nulo quando vem vazio. */
export function normalizeTaxId(input: string | null | undefined): string | null {
  const normalized = (input ?? '').replace(PUNCTUATION, '').toUpperCase();
  return normalized === '' ? null : normalized;
}

/**
 * O dígito verificador do módulo 11 sobre os valores, com os pesos dados da esquerda para a direita:
 * 0 quando o resto é menor que 2, e senão 11 menos o resto.
 */
function checkDigit(values: readonly number[], weights: readonly number[]): number {
  const sum = values.reduce((total, value, index) => total + value * (weights[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Os pesos de 2 a `top`, da direita para a esquerda, recomeçando em 2 depois de `top`, para `length` posições. */
function weightsOf(length: number, top: number): number[] {
  return Array.from({ length }, (_, index) => ((length - 1 - index) % (top - 1)) + 2);
}

/** Se os dois últimos valores são os dígitos verificadores dos anteriores, com os pesos até `top`. */
function hasValidCheckDigits(values: readonly number[], top: number): boolean {
  const base = values.slice(0, -2);
  const first = checkDigit(base, weightsOf(base.length, top));
  const second = checkDigit([...base, first], weightsOf(base.length + 1, top));
  return values.at(-2) === first && values.at(-1) === second;
}

/** Se os caracteres são todos iguais, como "11111111111", que passam pela conta e não são documento. */
function isRepeated(value: string): boolean {
  return /^(.)\1*$/.test(value);
}

/** O motivo da recusa do documento que não é do tipo, para o usuário. */
export function invalidTaxIdMessage(type: EntityType): string {
  return type === 'individual'
    ? 'O CPF não é válido. Confira os números.'
    : 'O CNPJ não é válido. Confira os caracteres.';
}

/**
 * Se o documento, já normalizado, é um CPF válido na pessoa física ou um CNPJ válido na jurídica. No
 * CNPJ, cada caractere vale o código ASCII menos 48, o que dá aos algarismos o próprio valor.
 */
export function isValidTaxId(type: EntityType, taxId: string): boolean {
  const format = type === 'individual' ? CPF_FORMAT : CNPJ_FORMAT;
  if (!format.test(taxId) || isRepeated(taxId)) return false;
  const values = Array.from(taxId, (char) => char.charCodeAt(0) - 48);
  return hasValidCheckDigits(values, type === 'individual' ? 11 : 9);
}
