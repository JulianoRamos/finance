import type { Page } from '@playwright/test';

import { formatCnpj, uniqueCnpj } from './tax-ids';
import { createTestUser, requiredEnv, signIn, type TestUser } from './users';

/** Uma entidade de teste, como a api a devolve. */
export interface TestEntity {
  readonly id: string;
  readonly name: string;
}

/**
 * Cadastra pela api uma empresa com a operação de clínica ligada, com CNPJ próprio do teste e o nome
 * dado, ou um próprio, como o usuário faria pela tela.
 */
export async function createTestCompany(
  user: TestUser,
  name = `Clínica Teste ${crypto.randomUUID().slice(0, 8)}`,
): Promise<TestEntity> {
  const response = await fetch(`${requiredEnv('API_URL')}/v1/entities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.sessionToken}` },
    body: JSON.stringify({ type: 'company', name, taxId: formatCnpj(uniqueCnpj()), operations: ['clinic'] }),
  });
  if (response.status !== 201) {
    throw new Error(`O cadastro da entidade de teste respondeu ${String(response.status)}.`);
  }
  return (await response.json()) as TestEntity;
}

/** Entra com um usuário novo e abre uma empresa dele, com a clínica ligada, no caminho dado abaixo dela. */
export async function openTestCompany(page: Page, baseURL: string, subpath = ''): Promise<TestEntity> {
  const user = await createTestUser();
  const entity = await createTestCompany(user);
  await signIn(page.context(), user, baseURL);
  await page.goto(`/entities/${entity.id}${subpath}`);
  return entity;
}
