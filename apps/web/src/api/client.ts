import 'server-only';

import createClient from 'openapi-fetch';

import type { paths } from './schema';

/**
 * O cliente da api, tipado pelo esquema gerado da cópia da especificação (apps/api/openapi.json).
 * Só roda no servidor da web: a api fica na rede interna (ADR 0004).
 */
export const api = createClient<paths>({ baseUrl: process.env.API_URL ?? 'http://api:3001' });
