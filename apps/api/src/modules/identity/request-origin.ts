import type { Request } from 'express';

/**
 * A origem da requisição (regra 6.1): o primeiro endereço do X-Forwarded-For, que a web repassa e a api
 * aceita porque só a web a alcança (ADR 0004); sem ele, o endereço da conexão.
 */
export function originOf(request: Request): string {
  const forwarded = request.header('X-Forwarded-For')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.socket.remoteAddress ?? 'unknown';
}

/** O User-Agent do navegador, que a web repassa, ou nulo quando não veio. */
export function userAgentOf(request: Request): string | null {
  return request.header('User-Agent') ?? null;
}
