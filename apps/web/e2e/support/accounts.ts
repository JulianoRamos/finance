import type { Page } from '@playwright/test';

import { createTestIndividual, postAsUser, type TestEntity, uniqueName } from './entities';
import { createTestUser, signIn, type TestUser } from './users';

/** O dia de hoje menos os dias dados, como `AAAA-MM-DD`, no fuso do processo (o mesmo da web e da api). */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** O que uma conta de teste pode trocar no cadastro. */
export interface TestAccountBody {
  readonly name?: string;
  readonly openingBalance?: string;
  readonly openingBalanceDate?: string;
}

/** Uma movimentação manual, como a api a recebe. */
export interface TestMovement {
  readonly direction: 'inflow' | 'outflow';
  readonly date: string;
  readonly amount: string;
  readonly description: string;
}

/** Uma entrada e uma saída, para as telas que mostram as movimentações. */
export const TEST_MOVEMENTS: readonly TestMovement[] = [
  { direction: 'inflow', date: '2026-09-05', amount: '6250.00', description: 'Salário' },
  { direction: 'outflow', date: '2026-09-10', amount: '182.45', description: 'Mercado Bom Preço' },
];

/**
 * Cadastra pela api, com a sessão do usuário, uma conta corrente do Nubank na entidade, com um nome próprio
 * do teste e um saldo inicial longo, para a tela mostrar um valor de muitos dígitos, salvo o que `body`
 * trocar.
 */
export function createTestAccount(user: TestUser, entity: TestEntity, body: TestAccountBody = {}): Promise<TestEntity> {
  return postAsUser(
    user,
    '/v1/accounts',
    {
      entityId: entity.id,
      name: uniqueName('Nubank Teste'),
      type: 'checking',
      institution: 'nubank',
      isReserve: true,
      openingBalance: '1234567.89',
      openingBalanceDate: '2026-09-01',
      ...body,
    },
    'da conta de teste',
  );
}

/**
 * Entra com um usuário novo, com uma pessoa física dele como contexto financeiro e uma conta nela, com o que
 * `account` trocar e as `movements` registradas, e abre o caminho dado da tela Contas, ou o detalhe da conta.
 */
export async function openTestAccount(
  page: Page,
  baseURL: string,
  path?: string,
  { account: body = {}, movements = [] }: { account?: TestAccountBody; movements?: readonly TestMovement[] } = {},
): Promise<TestEntity> {
  const user = await createTestUser();
  const person = await createTestIndividual(user);
  const account = await createTestAccount(user, person, body);
  for (const movement of movements) {
    await postAsUser(user, `/v1/accounts/${account.id}/movements`, movement, 'da movimentação de teste');
  }
  await signIn(page.context(), user, baseURL);
  await page
    .context()
    .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL, httpOnly: true }]);
  await page.goto(path ?? `/accounts/${account.id}`);
  return account;
}
