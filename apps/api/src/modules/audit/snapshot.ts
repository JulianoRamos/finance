import { Decimal, type JsonObject, type JsonValue } from '../../common/index.js';

/**
 * Um campo sensível, retirado da auditoria pelo nome (LLD, seção 4.4): contém `password`, `secret` ou
 * `token`, ou termina em `Hash`. Sem distinguir maiúsculas, para valer também com o nome da coluna
 * (`code_hash`), como um registro lido em SQL o traz.
 */
function isSensitive(field: string): boolean {
  return /password|secret|token|hash$/i.test(field);
}

/** O instante, pelo nome (LLD, seção 4.1): termina em `At`, ou em `_at` no nome da coluna. */
const INSTANT = /(At|_at)$/;

/**
 * O valor de um campo em JSON (LLD, seção 4.4). O Prisma lê a data de calendário e o instante como
 * `Date`, e o nome os distingue: o instante vai em ISO 8601; a data de calendário, lida como
 * meia-noite em UTC, vira `"AAAA-MM-DD"`.
 */
function toJsonValue(field: string, value: unknown): JsonValue {
  if (Decimal.isDecimal(value)) return value.toFixed();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) {
    const iso = value.toISOString();
    return INSTANT.test(field) ? iso : iso.slice(0, 10);
  }
  // Os outros valores que o Prisma lê (texto, número, booleano, nulo, JSON) já são JSON.
  return value as JsonValue;
}

/**
 * Converte um registro para o antes ou o depois da auditoria (LLD, seção 4.4): os campos com os nomes
 * do modelo, sem os sensíveis.
 */
export function toSnapshot(record: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([field]) => !isSensitive(field))
      .map(([field, value]) => [field, toJsonValue(field, value)]),
  );
}
