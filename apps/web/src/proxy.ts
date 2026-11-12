import { type NextRequest, NextResponse } from 'next/server';

import { REQUEST_ID_HEADER } from '@/api/request-id';

/**
 * Gera o identificador de cada requisição do navegador e o repassa ao servidor da web como cabeçalho da
 * requisição, de onde o cliente da api o lê (src/api/client.ts). Um identificador vindo do navegador é
 * substituído: quem o define é a web.
 */
export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, crypto.randomUUID());
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Fora os arquivos estáticos do Next, que não chamam a api. Um caminho com ponto (como
  // /extratos/2026.03) pode ser uma rota, e passa pelo proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
