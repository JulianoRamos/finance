/** O texto do aparelho de uma sessão: "Chrome no macOS", só o navegador, ou "Navegador desconhecido". */
export function deviceText(browser: string | null, platform: string | null): string {
  if (!browser) return 'Navegador desconhecido';
  return platform ? `${browser} no ${platform}` : browser;
}

const INSTANT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Um instante como `dd/mm/aaaa hh:mm` (design-system.md, seção 3), no fuso do processo da web (TZ). */
export function formatInstant(instant: string): string {
  const parts = INSTANT.formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** O dia de um instante como `dd/mm/aaaa` (design-system.md, seção 3), no fuso do processo da web (TZ). */
export function formatDate(instant: string): string {
  return DATE.format(new Date(instant));
}

/** Uma data de calendário `AAAA-MM-DD` como `dd/mm/aaaa` (design-system.md, seção 3), sem passar por fuso. */
export function formatCalendarDate(date: string): string {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** As casas de uma fração com 8 casas que viram casas do percentual, depois das 2 que vão para o inteiro. */
const FRACTION_SCALE = 8;

/**
 * A fração da api ("0.20000000") como percentual ("20,0%"): com uma casa, e mais casas só quando a
 * fração as tem. A conta é feita no texto, sem ponto flutuante.
 */
export function formatFraction(fraction: string): string {
  const [whole = '0', decimals = ''] = fraction.split('.');
  const digits = decimals.padEnd(FRACTION_SCALE, '0');
  const integer = String(Number(`${whole}${digits.slice(0, 2)}`));
  const rest = digits.slice(2).replace(/0+$/, '').padEnd(1, '0');
  return `${integer},${rest}%`;
}

/**
 * O percentual digitado ("60", "20,5" ou "12.25") como a fração que a api recebe ("0.60", "0.205"),
 * sem ponto flutuante; nulo quando ele não é um número sem sinal com até 6 casas. O intervalo é
 * conferido pela api.
 */
export function percentToFraction(percent: string): string | null {
  // Até 6 casas: as 8 da fração menos as 2 que o percentual já desloca.
  const match = /^(\d+)(?:[,.](\d{1,6}))?$/.exec(percent.trim());
  if (!match) return null;
  const decimals = match[2] ?? '';
  const scale = decimals.length + 2;
  const digits = `${match[1] ?? ''}${decimals}`.padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale).replace(/^0+(?=\d)/, '');
  return `${whole}.${digits.slice(-scale)}`;
}

/** Um número com dois algarismos, como o dia e o mês de uma data. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** O dia de hoje como `AAAA-MM-DD`, no fuso do processo da web (TZ), o mesmo da api. */
export function todayCalendarDate(): string {
  const now = new Date();
  return `${String(now.getFullYear())}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`;
}

/** O último dia do mês anterior ao da data `AAAA-MM-DD`, também como `AAAA-MM-DD`, sem passar por fuso. */
export function endOfPreviousMonth(date: string): string {
  const [year = 0, month = 1] = date.split('-').map(Number);
  // O dia 0 de um mês é o último do anterior.
  const end = new Date(Date.UTC(year, month - 1, 0));
  return `${String(end.getUTCFullYear())}-${twoDigits(end.getUTCMonth() + 1)}-${twoDigits(end.getUTCDate())}`;
}

/**
 * Uma data com o ano inteiro: enquanto a pessoa digita o ano num campo de data, ele já vale "0002-09-15",
 * e o campo que pede algo ao servidor a cada data espera o ano completo.
 */
export const FULL_YEAR_DATE = /^[1-9]\d{3}-\d{2}-\d{2}$/;

/** Se o texto é uma data `AAAA-MM-DD` que existe. */
export function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}
