import 'server-only';

import { api } from './client';

/** O estado da api visto pela web. */
export type ApiState = 'up' | 'no_database' | 'down';

/**
 * Quanto a web espera a rota de saúde antes de dar a api como fora do ar. É maior que o prazo de
 * conexão com o banco da api (5 s), para a web ver o 503 da api sem o banco, e não o próprio estouro.
 */
const TIMEOUT_MS = 8000;

/** Pergunta à rota de saúde da api, a cada requisição, e traduz a resposta. */
export async function apiState(): Promise<ApiState> {
  try {
    const { data, error } = await api.GET('/v1/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (data?.database === 'connected') return 'up';
    if (error?.database === 'down') return 'no_database';
    return 'down';
  } catch {
    return 'down';
  }
}
