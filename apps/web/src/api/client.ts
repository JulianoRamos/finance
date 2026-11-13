import 'server-only';

import { cookies, headers } from 'next/headers';
import createClient from 'openapi-fetch';

import { REQUEST_ID_HEADER } from './request-id';
import type { paths } from './schema';
import { SESSION_COOKIE } from './session-cookie';

/**
 * O cliente da api, tipado pelo esquema gerado da cópia da especificação (apps/api/openapi.json).
 * Só roda no servidor da web: a api fica na rede interna (ADR 0004).
 */
export const api = createClient<paths>({ baseUrl: process.env.API_URL ?? 'http://api:3001' });

/**
 * Quanto a web espera uma resposta da api. É maior que o prazo de conexão com o banco da api (5 s), para
 * a web ver a recusa da api sem o banco, e não o próprio estouro.
 */
export const API_TIMEOUT_MS = 8000;

/**
 * A origem do navegador (regra 6.1): o último endereço do X-Forwarded-For recebido, o que o proxy da
 * frente gravou. O Caddy descarta o cabeçalho que o cliente manda e grava o endereço da conexão, e um
 * proxy confiável acrescenta o dele no fim; o que vem antes pode ser do próprio cliente. Sem o
 * cabeçalho, o Next o preenche com o endereço da conexão.
 */
function originOf(forwardedFor: string | null): string | null {
  const last = forwardedFor?.split(',').at(-1)?.trim();
  // Um cabeçalho vazio, ou terminado em vírgula, não traz endereço.
  if (!last) return null;
  return last;
}

// Toda chamada leva o identificador da requisição do navegador que a fez, gerado no proxy
// (src/proxy.ts), a origem e o User-Agent do navegador e, quando há, o token da sessão do cookie.
api.use({
  async onRequest({ request }) {
    const incoming = await headers();
    const requestId = incoming.get(REQUEST_ID_HEADER);
    if (requestId) request.headers.set(REQUEST_ID_HEADER, requestId);
    const origin = originOf(incoming.get('X-Forwarded-For'));
    if (origin) request.headers.set('X-Forwarded-For', origin);
    const userAgent = incoming.get('User-Agent');
    if (userAgent) request.headers.set('User-Agent', userAgent);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
});
