import 'server-only';

import { api, API_TIMEOUT_MS } from './client';

/** O estado da api visto pela web. */
export type ApiState = 'up' | 'no_database' | 'down';

/** Pergunta à rota de saúde da api, a cada requisição, e traduz a resposta. */
export async function apiState(): Promise<ApiState> {
  try {
    const { data, error } = await api.GET('/v1/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data?.database === 'connected') return 'up';
    if (error?.database === 'down') return 'no_database';
    return 'down';
  } catch {
    return 'down';
  }
}
