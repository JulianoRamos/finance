import { expect, test } from '@playwright/test';

import { createTestUser, signIn } from './support/users';

test('sair pelo menu da conta encerra a sessão', { tag: '@KAN-10-CA5' }, async ({ page, context, baseURL }) => {
  const user = await createTestUser();
  await signIn(context, user, baseURL ?? '');
  await page.goto('/');

  await page.getByRole('button', { name: user.name }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();

  await expect(page).toHaveURL('/login');
  await page.goto('/');
  await expect(page).toHaveURL('/login');

  // O cookie de antes volta ao navegador: a sessão tem de ter sido encerrada na api, e não só apagada.
  await signIn(context, user, baseURL ?? '');
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});
