import type { Page } from '@playwright/test';

import { createTestAccount, daysAgo } from './accounts';
import { createTestIndividual, postAsUser, type TestEntity, uniqueName } from './entities';
import { createTestUser, signIn } from './users';

/** Uma data `AAAA-MM-DD` como a tela a mostra, `dd/mm/aaaa`. */
export function shown(date: string): string {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** O lançamento de teste aberto e o que ele usa: a conta e a categoria. */
export interface TestEntry {
  readonly entry: TestEntity & { readonly description: string };
  readonly account: TestEntity;
  readonly category: TestEntity;
}

/**
 * Entra com um usuário novo, com uma pessoa física dele como contexto financeiro, uma conta e uma categoria
 * de despesa nela, e uma despesa de R$ 1.000,00 em 3 parcelas, a primeira vencendo hoje, e abre o caminho
 * dado da tela Lançamentos, ou o detalhe da despesa.
 */
export async function openTestEntry(page: Page, baseURL: string, path?: string): Promise<TestEntry> {
  const user = await createTestUser();
  const person = await createTestIndividual(user);
  const account = await createTestAccount(user, person);
  const category = await postAsUser(
    user,
    '/v1/categories',
    { name: uniqueName('Móveis Teste'), nature: 'expense' },
    'da categoria de teste',
  );
  const today = daysAgo(0);
  const entry = (await postAsUser(
    user,
    '/v1/entries',
    {
      entityId: person.id,
      type: 'expense',
      description: uniqueName('Sofá Teste'),
      categoryId: category.id,
      purpose: 'household',
      occurredOn: today,
      totalAmount: '1000.00',
      installmentCount: 3,
      firstDueDate: today,
      accountId: account.id,
    },
    'do lançamento de teste',
  )) as TestEntity & { description: string };
  await signIn(page.context(), user, baseURL);
  await page
    .context()
    .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL, httpOnly: true }]);
  await page.goto(path ?? `/entries/${entry.id}`);
  return { entry, account, category };
}
