/** Um ano, em segundos: um cookie de preferência da interface, e não de sessão. */
const ONE_YEAR_S = 365 * 24 * 60 * 60;

/**
 * Grava no navegador um cookie de preferência da interface (a barra lateral, o tema), por um ano, que
 * os layouts leem no servidor, para a página não piscar ao carregar.
 */
export function writePreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${String(ONE_YEAR_S)}; samesite=lax`;
}
