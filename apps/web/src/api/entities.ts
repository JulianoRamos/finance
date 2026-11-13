import 'server-only';

import { cache } from 'react';

import { type ApiError, contractError, UNAVAILABLE } from './api-error';
import { api, API_TIMEOUT_MS } from './client';
import type { components } from './schema';

export type Entity = components['schemas']['Entity'];
export type EntityType = Entity['type'];
export type Operation = Entity['operations'][number];
type NewEntity = components['schemas']['NewEntity'];
type EntityEdit = components['schemas']['EntityEdit'];

/**
 * As entidades, as ativas primeiro e cada grupo pelo nome; `unauthenticated` quando não há uma sessão
 * válida; ou `unavailable` quando a api não respondeu como o contrato diz.
 */
export type EntityList =
  { status: 'ok'; entities: Entity[] } | { status: 'unauthenticated' } | { status: 'unavailable' };

/** A lista das entidades, pedida uma vez por requisição, mesmo que o layout e a página a peçam. */
export const listEntities = cache(async (): Promise<EntityList> => {
  try {
    const { data, response } = await api.GET('/v1/entities', {
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data) return { status: 'ok', entities: data };
    return { status: response.status === 401 ? 'unauthenticated' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
});

/** A entidade do id; `not-found` quando ela não existe, ou o id nem é um id. */
export type EntityLookup =
  | { status: 'ok'; entity: Entity }
  | { status: 'not-found' }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

export async function getEntity(id: string): Promise<EntityLookup> {
  try {
    const { data, response } = await api.GET('/v1/entities/{id}', {
      params: { path: { id } },
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (data) return { status: 'ok', entity: data };
    if (response.status === 404 || response.status === 400) return { status: 'not-found' };
    return { status: response.status === 401 ? 'unauthenticated' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** O resultado de um comando sobre uma entidade: ela, como ficou, ou o erro do contrato. */
export type EntityResult = { ok: true; entity: Entity } | ({ ok: false } & ApiError);

/** Faz o pedido que devolve a entidade e traduz a resposta, ou a falta dela. */
async function entityResult(
  call: (signal: AbortSignal) => Promise<{ data?: Entity; error?: unknown }>,
): Promise<EntityResult> {
  try {
    const { data, error } = await call(AbortSignal.timeout(API_TIMEOUT_MS));
    if (data) return { ok: true, entity: data };
    return { ok: false, ...contractError(error) };
  } catch {
    return { ok: false, ...UNAVAILABLE };
  }
}

/** Cadastra uma entidade. */
export function createEntity(body: NewEntity): Promise<EntityResult> {
  return entityResult((signal) => api.POST('/v1/entities', { body, signal }));
}

/** Troca o nome e o documento de uma entidade, com a versão lida. */
export function updateEntity(id: string, body: EntityEdit): Promise<EntityResult> {
  return entityResult((signal) => api.PUT('/v1/entities/{id}', { params: { path: { id } }, body, signal }));
}

/** Desativa ou reativa uma entidade, com a versão lida. */
export function setEntityActive(id: string, active: boolean, version: number): Promise<EntityResult> {
  return entityResult((signal) =>
    api.PUT('/v1/entities/{id}/active', { params: { path: { id } }, body: { active, version }, signal }),
  );
}

/** Liga uma operação numa empresa. */
export function enableOperation(id: string, operation: Operation): Promise<EntityResult> {
  return entityResult((signal) =>
    api.PUT('/v1/entities/{id}/operations/{operation}', { params: { path: { id, operation } }, signal }),
  );
}

/** Desliga uma operação numa empresa. */
export function disableOperation(id: string, operation: Operation): Promise<EntityResult> {
  return entityResult((signal) =>
    api.DELETE('/v1/entities/{id}/operations/{operation}', { params: { path: { id, operation } }, signal }),
  );
}
