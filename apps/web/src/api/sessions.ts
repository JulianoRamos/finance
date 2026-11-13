import 'server-only';

import { api, API_TIMEOUT_MS } from './client';
import type { components } from './schema';

type ApiError = components['schemas']['ApiError'];
type SessionToken = components['schemas']['SessionToken'];
export type SessionUser = components['schemas']['SessionUser'];

/** A recusa quando a api não responde como o contrato diz. */
const UNAVAILABLE: ApiError = {
  code: 'UNAVAILABLE',
  message: 'Não foi possível falar com o servidor. Tente de novo em instantes.',
};

/** O resultado de um pedido que abre uma sessão: o token, ou o erro do contrato. */
export type SessionResult = { ok: true; session: SessionToken } | ({ ok: false } & ApiError);

/** Faz o pedido que abre uma sessão e traduz a resposta, ou a falta dela. */
async function sessionResult(
  call: (signal: AbortSignal) => Promise<{ data?: SessionToken; error?: unknown }>,
): Promise<SessionResult> {
  try {
    const { data, error } = await call(AbortSignal.timeout(API_TIMEOUT_MS));
    if (data) return { ok: true, session: data };
    const body = error as Partial<ApiError> | undefined;
    return body?.code && body.message ? { ok: false, ...(body as ApiError) } : { ok: false, ...UNAVAILABLE };
  } catch {
    return { ok: false, ...UNAVAILABLE };
  }
}

/** Entra com o e-mail e a senha. */
export function login(email: string, password: string): Promise<SessionResult> {
  return sessionResult((signal) => api.POST('/v1/sessions', { body: { email, password }, signal }));
}

/**
 * A sessão do cookie: o usuário dela; `unauthenticated` quando não há uma sessão válida; ou
 * `unavailable` quando a api não respondeu como o contrato diz, e não dá para saber.
 */
export type CurrentSession =
  { status: 'authenticated'; user: SessionUser } | { status: 'unauthenticated' } | { status: 'unavailable' };

export async function currentSession(): Promise<CurrentSession> {
  try {
    const { data, response } = await api.GET('/v1/sessions/current', {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data) return { status: 'authenticated', user: data.user };
    return { status: response.status === 401 ? 'unauthenticated' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * O link de recuperação: o e-mail dele, quando vale; `invalid` quando venceu, foi usado ou não existe;
 * ou `refused`, com a mensagem, quando a api recusou a consulta (tentativas demais) ou não respondeu.
 */
export type RecoveryLinkLookup =
  { status: 'valid'; email: string } | { status: 'invalid' } | { status: 'refused'; message: string };

export async function lookUpRecoveryLink(token: string): Promise<RecoveryLinkLookup> {
  try {
    const { data, error, response } = await api.GET('/v1/recovery-links/{token}', {
      params: { path: { token } },
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data) return { status: 'valid', email: data.email };
    if (response.status === 404) return { status: 'invalid' };
    // Uma resposta fora do contrato, como um 500 sem corpo, chega sem o corpo de erro.
    const body = error as Partial<ApiError> | undefined;
    return { status: 'refused', message: body?.message ?? UNAVAILABLE.message };
  } catch {
    return { status: 'refused', message: UNAVAILABLE.message };
  }
}

/** Usa o link de recuperação: define a senha e abre uma sessão. */
export function redeemRecoveryLink(
  token: string,
  password: string,
  passwordConfirmation: string,
): Promise<SessionResult> {
  return sessionResult((signal) =>
    api.POST('/v1/recovery-links/{token}/use', {
      params: { path: { token } },
      body: { password, passwordConfirmation },
      signal,
    }),
  );
}
