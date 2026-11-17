import type { Locator, Page } from '@playwright/test';

import { formatCnpj, uniqueCnpj } from './tax-ids';
import { createTestUser, requiredEnv, signIn, type TestUser, withDevDatabase } from './users';

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

/** Registra pela api a participação do sócio na empresa, sem fim, desde o início dado. */
export async function createTestEquityStake(
  user: TestUser,
  company: TestEntity,
  holder: TestEntity,
  { fraction, startDate }: { fraction: string; startDate: string },
): Promise<void> {
  await postAsUser(
    user,
    `/v1/entities/${company.id}/equity-stakes`,
    { holderId: holder.id, fraction, startDate },
    'da participação de teste',
  );
}

/** Cria pela api um grupo financeiro com os membros dados e o nome dado, ou um próprio do teste. */
export function createTestGroup(
  user: TestUser,
  members: readonly TestEntity[],
  name = uniqueName('Grupo Teste'),
): Promise<TestEntity> {
  return postAsUser(
    user,
    '/v1/financial-groups',
    { name, memberIds: members.map((member) => member.id) },
    'do grupo de teste',
  );
}

/**
 * Exclui pela api o grupo de teste, para os grupos dos testes não se acumularem no banco de
 * desenvolvimento, onde aparecem para todos os usuários.
 */
export async function deleteTestGroup(user: TestUser, id: string): Promise<void> {
  const response = await fetch(`${requiredEnv('API_URL')}/v1/financial-groups/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user.sessionToken}` },
  });
  if (response.status !== 204) {
    throw new Error(`A exclusão do grupo de teste respondeu ${String(response.status)}.`);
  }
}

/**
 * Busca a entidade numa escolha de entidades, como os membros de um grupo ou o sócio de uma participação,
 * quando há a busca (mais de 10 entidades): o banco de desenvolvimento guarda as de outras execuções, e a
 * do teste pode ficar fora da primeira página.
 */
export async function findEntityOption(scope: Locator, name: string): Promise<void> {
  const search = scope.getByRole('searchbox', { name: 'Buscar entidade' });
  if ((await search.count()) > 0) await search.fill(name);
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

/**
 * Dá ao usuário de teste `view` em cada membro atual da Visão Familiar, gravado no banco de
 * desenvolvimento com o papel da api. O banco guarda nela os membros de outras execuções, em que o
 * usuário de teste não tem permissão, e sem isso ela some da lista dos grupos para ele (regra 6.2).
 */
export async function grantFamilyViewAccess(user: TestUser): Promise<void> {
  await withDevDatabase(async (client) => {
    await client.query(
      `INSERT INTO permission (user_id, entity_id, level, created_at, updated_at)
       SELECT u.id, member.entity_id, 'view', now(), now()
       FROM "user" u, financial_group_member member
       JOIN financial_group grp ON grp.id = member.financial_group_id
       WHERE u.email = $1 AND grp.is_family_view
       ON CONFLICT (user_id, entity_id) DO NOTHING`,
      [user.email],
    );
  });
}
