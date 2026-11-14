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

type ChangePassword = components['schemas']['ChangePassword'];
export type User = components['schemas']['User'];
export type UserPage = components['schemas']['UserPage'];
type NewUser = components['schemas']['NewUser'];
type UserEdit = components['schemas']['UserEdit'];
type UserAccess = components['schemas']['UserAccess'];
export type CreatedUser = components['schemas']['CreatedUser'];
export type GeneratedRecoveryLink = components['schemas']['GeneratedRecoveryLink'];
export type PermissionChange = components['schemas']['PermissionChange'];
export type AccessLevel = PermissionChange['level'];
export type EntityPermission = components['schemas']['EntityPermission'];
export type EntityPermissionPage = components['schemas']['EntityPermissionPage'];

/** Troca a senha do usuário do cookie; a api encerra as outras sessões dele. */
export function changePassword(body: ChangePassword): Promise<CommandResult> {
  return commandResult((signal) => api.PUT('/v1/users/me/password', { body, signal }));
}

/**
 * A página dos usuários da busca, os ativos primeiro e cada grupo pelo nome; `not-found` para quem não
 * gere acessos. Pedida uma vez por requisição, mesmo que o layout e a página peçam a mesma.
 */
export const listUsers = cache((page = 1, q = ''): Promise<ReadResult<UserPage>> =>
  readResult((init) => api.GET('/v1/users', { params: { query: { page, q } }, ...init })),
);

/** O usuário do id; `not-found` quando ele não existe, ou para quem não gere acessos. */
export function getUser(id: string): Promise<ReadResult<User>> {
  return readResult((init) => api.GET('/v1/users/{id}', { params: { path: { id } }, ...init }));
}

/** A página das entidades da busca, com o nível do usuário em cada uma. */
export function listUserPermissions(id: string, page = 1, q = ''): Promise<ReadResult<EntityPermissionPage>> {
  return readResult((init) =>
    api.GET('/v1/users/{id}/permissions', { params: { path: { id }, query: { page, q } }, ...init }),
  );
}

/** Cadastra um usuário, com as permissões dele, e devolve o link para ele definir a senha. */
export function createUser(body: NewUser): Promise<DataResult<CreatedUser>> {
  return dataResult((signal) => api.POST('/v1/users', { body, signal }));
}

/** Troca o nome e o e-mail de um usuário, com a versão lida. */
export function updateUser(id: string, body: UserEdit): Promise<DataResult<User>> {
  return dataResult((signal) => api.PUT('/v1/users/{id}', { params: { path: { id } }, body, signal }));
}

/** Desativa ou reativa um usuário, com a versão lida. */
export function setUserActive(id: string, active: boolean, version: number): Promise<DataResult<User>> {
  return dataResult((signal) =>
    api.PUT('/v1/users/{id}/active', { params: { path: { id } }, body: { active, version }, signal }),
  );
}

/** Grava o gerir acessos e as permissões que mudam, com a versão lida. */
export function setUserAccess(id: string, body: UserAccess): Promise<DataResult<User>> {
  return dataResult((signal) => api.PUT('/v1/users/{id}/access', { params: { path: { id } }, body, signal }));
}

/** Gera um link de recuperação para o usuário. */
export function createRecoveryLink(id: string): Promise<DataResult<GeneratedRecoveryLink>> {
  return dataResult((signal) => api.POST('/v1/users/{id}/recovery-links', { params: { path: { id } }, signal }));
}
