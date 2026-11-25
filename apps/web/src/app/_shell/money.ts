// O dinheiro como a tela o mostra e o recebe (design-system.md, seção 3, e "Campo de valor", seção 4.3).
// A api manda e recebe a string decimal do contrato, e a web nunca a converte em ponto flutuante.

/** O sinal de menos tipográfico, que o valor negativo leva. */
const MINUS = '−';

/** As partes da string decimal da api ("-1234.5"): o sinal, os inteiros e os centavos, sempre com 2 dígitos. */
function splitDecimal(decimal: string): { negative: boolean; whole: string; cents: string } {
  const [whole = '0', cents = ''] = decimal.replace(/^-/, '').split('.');
  return { negative: decimal.startsWith('-'), whole, cents: cents.padEnd(2, '0').slice(0, 2) };
}

/**
 * A string decimal ("-1234.5") no formato brasileiro, sem a moeda: "−1.234,50", com o milhar em ponto e
 * sempre os centavos. A conta é feita no texto, sem passar por número, para nenhum dígito se perder.
 */
function formatDecimal(decimal: string): { sign: string; number: string } {
  const { negative, whole, cents } = splitDecimal(decimal);
  const grouped = (whole.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+$)/g, '.');
  const zero = /^0*$/.test(whole + cents);
  return { sign: negative && !zero ? MINUS : '', number: `${grouped},${cents}` };
}

/** A string decimal da api ("-150.25") como dinheiro: `−R$ 150,25`, sempre com os centavos. */
export function formatMoney(decimal: string): string {
  const { sign, number } = formatDecimal(decimal);
  // O espaço entre a moeda e o valor não quebra, como o do `Intl.NumberFormat` (design-system.md, seção 3).
  return `${sign}R$\u00a0${number}`;
}

/** A string decimal da api ("2000.00") como o campo de valor a mostra: "2.000,00", com o sinal, se houver. */
export function formatMoneyInput(decimal: string): string {
  const { sign, number } = formatDecimal(decimal);
  return `${sign}${number}`;
}

/**
 * O valor digitado ("1.234,56", "1234,56", "−150" ou "-150,5") como a string decimal da api ("1234.56"),
 * sem ponto flutuante; nulo quando não é um valor com até 2 casas. O ponto é o separador de milhar.
 */
export function parseMoneyInput(text: string): string | null {
  const match = /^([-−]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text.trim().replace(/\s/g, ''));
  if (!match) return null;
  const [, sign = '', whole = '', cents = ''] = match;
  const integer = whole.replaceAll('.', '').replace(/^0+(?=\d)/, '');
  const value = `${integer}.${cents.padEnd(2, '0')}`;
  return sign !== '' && value !== '0.00' ? `-${value}` : value;
}

/**
 * O valor de uma movimentação, sempre positivo na api, com o sinal do sentido: "+ R$ 500,00" na entrada e
 * "− R$ 182,45" na saída, como o protótipo (design-system.md, seção 3).
 */
export function formatFlow(amount: string, direction: 'inflow' | 'outflow'): string {
  return `${direction === 'inflow' ? '+' : MINUS} ${formatMoney(amount)}`;
}

/** A string decimal da api ("-150.25") em centavos, sem ponto flutuante. */
export function toCents(decimal: string): bigint {
  const { negative, whole, cents } = splitDecimal(decimal);
  const value = BigInt(whole || '0') * 100n + BigInt(cents);
  return negative ? -value : value;
}

/**
 * A diferença `a - b` entre duas strings decimais da api, como o valor positivo ("12.90") e o sentido:
 * entrada quando `a` é maior, saída quando é menor; nula quando são iguais.
 */
export function directedDifference(a: string, b: string): { amount: string; direction: 'inflow' | 'outflow' } | null {
  const cents = toCents(a) - toCents(b);
  if (cents === 0n) return null;
  return { amount: fromCents(cents < 0n ? -cents : cents), direction: cents < 0n ? 'outflow' : 'inflow' };
}

/** Os centavos positivos como a string decimal da api (100000n → "1000.00"). */
export function fromCents(cents: bigint): string {
  return `${String(cents / 100n)}.${String(cents % 100n).padStart(2, '0')}`;
}

/** Um valor positivo com o sentido por extenso: "Saída de R$ 12,90" ou "Entrada de R$ 30,00". */
export function formatDirectedMoney(amount: string, direction: 'inflow' | 'outflow'): string {
  return `${direction === 'inflow' ? 'Entrada' : 'Saída'} de ${formatMoney(amount)}`;
}
