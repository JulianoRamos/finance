import type { Page } from '@playwright/test';

import { formatCnpj, uniqueCnpj } from './tax-ids';
import { createTestUser, requiredEnv, signIn, type TestUser } from './users';

/** Um registro de teste, como a api o devolve: uma entidade ou um grupo. */
export interface TestEntity {
  readonly id: string;
  readonly name: string;
}

/** Um nome próprio do teste: o banco de desenvolvimento guarda os registros de outras execuções. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`;
}

/** Cria pela api, com a sessão do usuário, o registro do caminho dado, e o devolve. */
async function postAsUser(user: TestUser, path: string, body: object, what: string): Promise<TestEntity> {
  const response = await fetch(`${requiredEnv('API_URL')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.sessionToken}` },
    body: JSON.stringify(body),
  });
  if (response.status !== 201) {
    throw new Error(`O cadastro ${what} respondeu ${String(response.status)}.`);
  }
  return (await response.json()) as TestEntity;
}

/**
 * Cadastra pela api uma empresa com a operação de clínica ligada, com CNPJ próprio do teste e o nome
 * dado, ou um próprio, como o usuário faria pela tela.
 */
export function createTestCompany(user: TestUser, name = uniqueName('Clínica Teste')): Promise<TestEntity> {
  return postAsUser(
    user,
    '/v1/entities',
    { type: 'company', name, taxId: formatCnpj(uniqueCnpj()), operations: ['clinic'] },
    'da entidade de teste',
  );
}

/** Cadastra pela api uma pessoa física, sem documento, com o nome dado, ou um próprio do teste. */
export function createTestIndividual(user: TestUser, name = uniqueName('Ana Teste')): Promise<TestEntity> {
  return postAsUser(user, '/v1/entities', { type: 'individual', name }, 'da pessoa física de teste');
}

/** Cria pela api um grupo financeiro com os membros dados e um nome próprio do teste. */
export function createTestGroup(user: TestUser, members: readonly TestEntity[]): Promise<TestEntity> {
  return postAsUser(
    user,
    '/v1/financial-groups',
    { name: uniqueName('Grupo Teste'), memberIds: members.map((member) => member.id) },
    'do grupo de teste',
  );
}

/** Entra com um usuário novo e abre uma empresa dele, com a clínica ligada, no caminho dado abaixo dela. */
export async function openTestCompany(page: Page, baseURL: string, subpath = ''): Promise<TestEntity> {
  const user = await createTestUser();
  const entity = await createTestCompany(user);
  await signIn(page.context(), user, baseURL);
  await page.goto(`/entities/${entity.id}${subpath}`);
  return entity;
}

/** Entra com um usuário novo e abre o formulário de um grupo dele, com uma pessoa física e uma empresa. */
export async function openTestGroup(page: Page, baseURL: string): Promise<TestEntity> {
  const user = await createTestUser();
  const group = await createTestGroup(user, [await createTestIndividual(user), await createTestCompany(user)]);
  await signIn(page.context(), user, baseURL);
  await page.goto(`/financial-groups/${group.id}`);
  return group;
}
