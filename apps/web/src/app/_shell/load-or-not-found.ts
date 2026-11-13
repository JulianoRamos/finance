import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';

import type { ReadResult } from '@/api/api-error';

/**
 * O registro que a página mostra, pedido a cada abertura: sem sessão, vai para o login; sem o registro,
 * para a página de não encontrada; e devolve nulo quando a api não respondeu.
 */
export async function loadOrNotFound<T>(read: () => Promise<ReadResult<T>>): Promise<T | null> {
  await connection();
  const result = await read();
  if (result.status === 'unauthenticated') redirect('/login');
  if (result.status === 'not-found') notFound();
  return result.status === 'ok' ? result.data : null;
}
