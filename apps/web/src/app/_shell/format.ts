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
