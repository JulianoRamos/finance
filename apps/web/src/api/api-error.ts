import 'server-only';

import { API_TIMEOUT_MS } from './client';
import type { components } from './schema';

export type ApiError = components['schemas']['ApiError'];

/** A recusa quando a api não responde como o contrato diz. */
export const UNAVAILABLE: ApiError = {
  code: 'UNAVAILABLE',
  message: 'Não foi possível falar com o servidor. Tente de novo em instantes.',
};

/** O erro do contrato que a api devolveu, ou a recusa de indisponível quando o corpo não é um. */
export function contractError(error: unknown): ApiError {
  const body = error as Partial<ApiError> | undefined;
  return body?.code && body.message ? (body as ApiError) : UNAVAILABLE;
}

/** O resultado de um pedido sem corpo na resposta: ok, ou o erro do contrato. */
export type CommandResult = { ok: true } | ({ ok: false } & ApiError);

/** Faz o pedido sem corpo na resposta e traduz o status, ou a falta de resposta. */
export async function commandResult(
  call: (signal: AbortSignal) => Promise<{ error?: unknown; response: Response }>,
): Promise<CommandResult> {
  try {
    const { error, response } = await call(AbortSignal.timeout(API_TIMEOUT_MS));
    if (response.ok) return { ok: true };
    return { ok: false, ...contractError(error) };
  } catch {
    return { ok: false, ...UNAVAILABLE };
  }
}

/** O resultado de um comando que devolve o registro: ele, como ficou, ou o erro do contrato. */
export type DataResult<T> = { ok: true; data: T } | ({ ok: false } & ApiError);

/** Faz o pedido que devolve o registro e traduz a resposta, ou a falta dela. */
export async function dataResult<T>(
  call: (signal: AbortSignal) => Promise<{ data?: T; error?: unknown }>,
): Promise<DataResult<T>> {
  try {
    const { data, error } = await call(AbortSignal.timeout(API_TIMEOUT_MS));
    if (data) return { ok: true, data };
    return { ok: false, ...contractError(error) };
  } catch {
    return { ok: false, ...UNAVAILABLE };
  }
}

/**
 * O que uma leitura devolve: o dado; `not-found` quando o registro do id não existe, ou o id nem é um
 * id; `unauthenticated` quando não há uma sessão válida; ou `unavailable` quando a api não respondeu
 * como o contrato diz.
 */
export type ReadResult<T> =
  { status: 'ok'; data: T } | { status: 'not-found' } | { status: 'unauthenticated' } | { status: 'unavailable' };

/** Faz a leitura do estado de agora, sem cache e com prazo, e traduz a resposta, ou a falta dela. */
export async function readResult<T>(
  call: (init: { cache: 'no-store'; signal: AbortSignal }) => Promise<{ data?: T; response: Response }>,
): Promise<ReadResult<T>> {
  try {
    const { data, response } = await call({ cache: 'no-store', signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (data) return { status: 'ok', data };
    if (response.status === 404 || response.status === 400) return { status: 'not-found' };
    return { status: response.status === 401 ? 'unauthenticated' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
