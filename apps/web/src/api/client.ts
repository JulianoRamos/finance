import 'server-only';

import { headers } from 'next/headers';
import createClient from 'openapi-fetch';

import { REQUEST_ID_HEADER } from './request-id';
import type { paths } from './schema';

/**
 * O cliente da api, tipado pelo esquema gerado da cópia da especificação (apps/api/openapi.json).
 * Só roda no servidor da web: a api fica na rede interna (ADR 0004).
 */
export const api = createClient<paths>({ baseUrl: process.env.API_URL ?? 'http://api:3001' });

// Toda chamada leva o identificador da requisição do navegador que a fez, gerado no proxy (src/proxy.ts).
api.use({
  async onRequest({ request }) {
    const requestId = (await headers()).get(REQUEST_ID_HEADER);
    if (requestId) request.headers.set(REQUEST_ID_HEADER, requestId);
    return request;
  },
});
