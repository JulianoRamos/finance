import { ValidateBy, type ValidationOptions } from 'class-validator';

import { Decimal } from './prisma-types.js';

// O valor decimal que trafega como string (LLD, seção 4.1), para não perder casas no número do JSON.

/** Um decimal sem sinal, com a parte inteira e, se houver, as casas depois do ponto. */
const DECIMAL_TEXT = /^\d+(?:\.(\d+))?$/;

/** O intervalo e as casas que um decimal aceita: acima de `above` (excluído) e até `atMost` (incluído). */
export interface DecimalRange {
  readonly above: string;
  readonly atMost: string;
  readonly scale: number;
}

/** Se o texto é um decimal do intervalo, com no máximo as casas dele. */
function isDecimalText(value: unknown, range: DecimalRange): value is string {
  if (typeof value !== 'string') return false;
  const match = DECIMAL_TEXT.exec(value);
  if (!match || (match[1]?.length ?? 0) > range.scale) return false;
  const decimal = new Decimal(value);
  return decimal.greaterThan(range.above) && decimal.lessThanOrEqualTo(range.atMost);
}

/** O campo é uma string decimal do intervalo, com no máximo as casas dele. */
export function IsDecimalText(range: DecimalRange, options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    { name: 'isDecimalText', validator: { validate: (value) => isDecimalText(value, range) } },
    options,
  );
}
