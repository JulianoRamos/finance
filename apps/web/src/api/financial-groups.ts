import 'server-only';

import { cache } from 'react';

import {
  type CommandResult,
  commandResult,
  type DataResult,
  dataResult,
  type ReadResult,
  readResult,
} from './api-error';
import { api } from './client';
import type { components } from './schema';

export type FinancialGroup = components['schemas']['FinancialGroup'];
export type FinancialGroupMember = FinancialGroup['members'][number];
type NewFinancialGroup = components['schemas']['NewFinancialGroup'];
type FinancialGroupEdit = components['schemas']['FinancialGroupEdit'];

/** Os grupos, a Visão Familiar primeiro e os outros pelo nome. */
export type FinancialGroupList = ReadResult<FinancialGroup[]>;

/** A lista dos grupos, pedida uma vez por requisição, mesmo que o layout e a página a peçam. */
export const listFinancialGroups = cache((): Promise<FinancialGroupList> =>
  readResult((init) => api.GET('/v1/financial-groups', init)),
);

/** O grupo do id; `not-found` quando ele não existe, ou o id nem é um id. */
export function getFinancialGroup(id: string): Promise<ReadResult<FinancialGroup>> {
  return readResult((init) => api.GET('/v1/financial-groups/{id}', { params: { path: { id } }, ...init }));
}

/** O resultado de um comando que devolve o grupo: ele, como ficou, ou o erro do contrato. */
export type FinancialGroupResult = DataResult<FinancialGroup>;

/** Cria um grupo, com os membros. */
export function createFinancialGroup(body: NewFinancialGroup): Promise<FinancialGroupResult> {
  return dataResult((signal) => api.POST('/v1/financial-groups', { body, signal }));
}

/** Troca o nome e a lista inteira dos membros de um grupo, com a versão lida. */
export function updateFinancialGroup(id: string, body: FinancialGroupEdit): Promise<FinancialGroupResult> {
  return dataResult((signal) => api.PUT('/v1/financial-groups/{id}', { params: { path: { id } }, body, signal }));
}

/** Exclui um grupo. As entidades não mudam. */
export function deleteFinancialGroup(id: string): Promise<CommandResult> {
  return commandResult((signal) => api.DELETE('/v1/financial-groups/{id}', { params: { path: { id } }, signal }));
}
