import type { AuditAction, JsonObject, JsonValue } from '../../common/index.js';

/** O valor de um campo no histórico: texto, número, booleano, ou nulo quando o campo está vazio. */
export type ChangeValue = string | number | boolean | null;

/** Um campo que mudou numa alteração: o valor de antes e o de depois, em JSON (LLD, seção 4.4). */
export interface FieldChange {
  readonly field: string;
  readonly before: ChangeValue;
  readonly after: ChangeValue;
}

/**
 * O valor do campo como o histórico o mostra. Os campos do histórico são valores simples, e um objeto
 * ou uma lista, que nenhum deles guarda hoje, vai como o texto do JSON.
 */
function toChangeValue(value: JsonValue | undefined): ChangeValue {
  if (value === undefined || value === null) return null;
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

/**
 * O que mudou, campo a campo, só nos campos dados, na ordem deles (LLD, seção 4.4): na criação, os
 * preenchidos, com o antes nulo; na alteração, os que mudaram; na exclusão, os que havia, com o depois
 * nulo.
 */
export function changesOf(
  action: AuditAction,
  before: JsonObject | null,
  after: JsonObject | null,
  fields: readonly string[],
): FieldChange[] {
  return fields.flatMap((field) => {
    const old = toChangeValue(before?.[field]);
    const current = toChangeValue(after?.[field]);
    if (action === 'create' && current === null) return [];
    if (action === 'delete' && old === null) return [];
    if (action === 'update' && old === current) return [];
    return [{ field, before: old, after: current }];
  });
}
