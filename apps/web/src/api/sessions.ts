import 'server-only';

import { cache } from 'react';

import { type ApiError, type CommandResult, commandResult, contractError, UNAVAILABLE } from './api-error';
import { api, API_TIMEOUT_MS } from './client';
import type { components } from './schema';

type SessionToken = components['schemas']['SessionToken'];
export type SessionUser = components['schemas']['SessionUser'];
export type SessionSummary = components['schemas']['SessionSummary'];

/** O resultado de um pedido que abre uma sessão: o token, ou o erro do contrato. */
export type SessionResult = { ok: true; session: SessionToken } | ({ ok: false } & ApiError);

/** Faz o pedido que abre uma sessão e traduz a resposta, ou a falta dela. */
async function sessionResult(
  call: (signal: AbortSignal) => Promise<{ data?: SessionToken; error?: unknown }>,
): Promise<SessionResult> {
  try {
    const { data, error } = await call(AbortSignal.timeout(API_TIMEOUT_MS));
    if (data) return { ok: true, session: data };
    return { ok: false, ...contractError(error) };
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

/** A sessão do cookie, pedida uma vez por requisição, mesmo que o layout e a página a peçam. */
export const currentSession = cache(async (): Promise<CurrentSession> => {
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
});

/**
 * As sessões ativas do usuário do cookie, a corrente primeiro; `unauthenticated` quando não há uma
 * sessão válida; ou `unavailable` quando a api não respondeu como o contrato diz.
 */
export type SessionList =
  { status: 'ok'; sessions: SessionSummary[] } | { status: 'unauthenticated' } | { status: 'unavailable' };

export async function listSessions(): Promise<SessionList> {
  try {
    const { data, response } = await api.GET('/v1/sessions', {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data) return { status: 'ok', sessions: data };
    return { status: response.status === 401 ? 'unauthenticated' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Encerra uma sessão ativa do usuário do cookie. */
export function endSession(id: string): Promise<CommandResult> {
  return commandResult((signal) => api.DELETE('/v1/sessions/{id}', { params: { path: { id } }, signal }));
}

/** Sai: encerra a sessão do cookie na api. */
export function endCurrentSession(): Promise<CommandResult> {
  return commandResult((signal) => api.DELETE('/v1/sessions/current', { signal }));
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
