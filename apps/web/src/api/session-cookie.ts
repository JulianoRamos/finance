import 'server-only';

import { cookies } from 'next/headers';

/** O cookie que guarda o token da sessão, que só o servidor da web lê. */
export const SESSION_COOKIE = 'session';

/**
 * Guarda o token da sessão no cookie, até o prazo máximo dela. O `Secure` só sai no desenvolvimento,
 * com `COOKIE_SECURE=false` (LLD, seção 9).
 */
export async function storeSession(session: { token: string; expiresAt: string }): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  });
}

/** Apaga o cookie da sessão. */
export async function clearSession(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/' });
}
