import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';

import { type Entity, getEntity } from '@/api/entities';

/**
 * A entidade do id, como o detalhe e a edição a pedem a cada abertura: sem sessão, vai para o login;
 * sem a entidade, para a página de não encontrada; e devolve nulo quando a api não respondeu.
 */
export async function loadEntity(id: string): Promise<Entity | null> {
  await connection();
  const lookup = await getEntity(id);
  if (lookup.status === 'unauthenticated') redirect('/login');
  if (lookup.status === 'not-found') notFound();
  return lookup.status === 'ok' ? lookup.entity : null;
}
