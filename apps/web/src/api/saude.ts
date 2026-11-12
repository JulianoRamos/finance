import 'server-only';

import { api } from './cliente';

/** O estado da api visto pela web. */
export type EstadoApi = 'no_ar' | 'sem_banco' | 'fora_do_ar';

/**
 * Quanto a web espera a rota de saúde antes de dar a api como fora do ar. É maior que o prazo de
 * conexão com o banco da api (5 s), para a web ver o 503 da api sem o banco, e não o próprio estouro.
 */
const PRAZO_MS = 8000;

/** Pergunta à rota de saúde da api, a cada requisição, e traduz a resposta. */
export async function estadoDaApi(): Promise<EstadoApi> {
  try {
    const { data, error } = await api.GET('/v1/saude', {
      cache: 'no-store',
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (data?.banco === 'conectado') return 'no_ar';
    if (error?.banco === 'fora_do_ar') return 'sem_banco';
    return 'fora_do_ar';
  } catch {
    return 'fora_do_ar';
  }
}
