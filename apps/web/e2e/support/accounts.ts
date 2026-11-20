import type { Page } from '@playwright/test';

import { createTestIndividual, postAsUser, type TestEntity, uniqueName } from './entities';
import { createTestUser, signIn, type TestUser } from './users';

/**
 * Cadastra pela api, com a sessão do usuário, uma conta corrente do Nubank na entidade, com o nome dado, ou
 * um próprio do teste, e um saldo inicial longo, para a tela mostrar um valor de muitos dígitos.
 */
export function createTestAccount(
  user: TestUser,
  entity: TestEntity,
  name = uniqueName('Nubank Teste'),
): Promise<TestEntity> {
  return postAsUser(
    user,
    '/v1/accounts',
    {
      entityId: entity.id,
      name,
      type: 'checking',
      institution: 'nubank',
      isReserve: true,
      openingBalance: '1234567.89',
      openingBalanceDate: '2026-09-01',
    },
    'da conta de teste',
  );
}

/**
 * Entra com um usuário novo, com uma pessoa física dele como contexto financeiro e uma conta nela, e abre
 * o caminho dado da tela Contas, ou o detalhe da conta.
 */
export async function openTestAccount(page: Page, baseURL: string, path?: string): Promise<TestEntity> {
  const user = await createTestUser();
  const person = await createTestIndividual(user);
  const account = await createTestAccount(user, person);
  await signIn(page.context(), user, baseURL);
  await page
    .context()
    .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL, httpOnly: true }]);
  await page.goto(path ?? `/accounts/${account.id}`);
  return account;
}
