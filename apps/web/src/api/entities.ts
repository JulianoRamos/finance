import 'server-only';

import { cache } from 'react';

import { type DataResult, dataResult, type ReadResult, readResult } from './api-error';
import { api } from './client';
import type { components } from './schema';

export type Entity = components['schemas']['Entity'];
export type EntityType = Entity['type'];
export type Operation = Entity['operations'][number];
type NewEntity = components['schemas']['NewEntity'];
type EntityEdit = components['schemas']['EntityEdit'];

export type EntityPage = components['schemas']['EntityPage'];

/** Uma página das entidades, as ativas primeiro e cada grupo pelo nome. */
export type EntityList = ReadResult<EntityPage>;

/**
 * A página das entidades da busca, com `active`, só as desse estado. Pedida uma vez por requisição,
 * mesmo que o layout e a página peçam a mesma.
 */
export const listEntities = cache((page = 1, q = '', active?: boolean): Promise<EntityList> =>
  readResult((init) =>
    api.GET('/v1/entities', {
      params: { query: { page, q, ...(active === undefined ? {} : { active }) } },
      ...init,
    }),
  ),
);

/** A entidade do id; `not-found` quando ela não existe, ou o id nem é um id. */
export function getEntity(id: string): Promise<ReadResult<Entity>> {
  return readResult((init) => api.GET('/v1/entities/{id}', { params: { path: { id } }, ...init }));
}

/** O resultado de um comando sobre uma entidade: ela, como ficou, ou o erro do contrato. */
export type EntityResult = DataResult<Entity>;

/** Cadastra uma entidade. */
export function createEntity(body: NewEntity): Promise<EntityResult> {
  return dataResult((signal) => api.POST('/v1/entities', { body, signal }));
}

/** Troca o nome e o documento de uma entidade, com a versão lida. */
export function updateEntity(id: string, body: EntityEdit): Promise<EntityResult> {
  return dataResult((signal) => api.PUT('/v1/entities/{id}', { params: { path: { id } }, body, signal }));
}

/** Desativa ou reativa uma entidade, com a versão lida. */
export function setEntityActive(id: string, active: boolean, version: number): Promise<EntityResult> {
  return dataResult((signal) =>
    api.PUT('/v1/entities/{id}/active', { params: { path: { id } }, body: { active, version }, signal }),
  );
}

/** Liga uma operação numa empresa. */
export function enableOperation(id: string, operation: Operation): Promise<EntityResult> {
  return dataResult((signal) =>
    api.PUT('/v1/entities/{id}/operations/{operation}', { params: { path: { id, operation } }, signal }),
  );
}

/** Desliga uma operação numa empresa. */
export function disableOperation(id: string, operation: Operation): Promise<EntityResult> {
  return dataResult((signal) =>
    api.DELETE('/v1/entities/{id}/operations/{operation}', { params: { path: { id, operation } }, signal }),
  );
}
