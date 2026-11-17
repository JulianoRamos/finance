import 'server-only';

/**
 * As opções dos cookies que só o servidor da web lê. O `Secure` só sai no desenvolvimento, com
 * `COOKIE_SECURE=false` (LLD, seção 9).
 */
export function privateCookieOptions() {
  return { httpOnly: true, secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'lax', path: '/' } as const;
}
