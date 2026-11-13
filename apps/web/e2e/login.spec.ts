import { expect, test } from '@playwright/test';

import { createTestUser, uniqueOrigin } from './support/users';

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos. Confira os dois e tente de novo.';

test.beforeEach(async ({ page }) => {
  // Uma origem própria, para as falhas de um teste não bloquearem a origem nas execuções seguintes.
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
});

test('o usuário entra com e-mail e senha', { tag: '@KAN-9-CA3' }, async ({ page }) => {
  const user = await createTestUser();

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText(user.name)).toBeVisible();
});

test('dados errados mostram o mesmo aviso, exista ou não o e-mail', { tag: '@KAN-9-CA3' }, async ({ page }) => {
  const user = await createTestUser();
  await page.goto('/login');
  // Envia e espera a resposta da ação do servidor, para o aviso conferido ser o desta tentativa.
  const submit = () =>
    Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/login')),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ]);

  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123');
  await submit();
  await expect(page.getByRole('alert')).toHaveText(INVALID_CREDENTIALS);

  await page.getByLabel('E-mail').fill(`ninguem-${user.email}`);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await submit();
  await expect(page.getByRole('alert')).toHaveText(INVALID_CREDENTIALS);

  await expect(page).toHaveURL('/login');
});
