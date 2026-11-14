import { expect, test } from '@playwright/test';

import { createTestUser, signIn, uniqueOrigin } from './support/users';

test('quem não gere acessos não vê a tela de usuários', { tag: '@KAN-13-CA5' }, async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  await signIn(page.context(), await createTestUser(), baseURL ?? '');

  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações' }).click();
  const menu = page.getByRole('menu', { name: 'Configurações' });
  await expect(menu.getByRole('menuitem', { name: 'Entidades' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Usuários e acessos' })).toHaveCount(0);

  await page.goto('/users');
  // A página não encontrada é a padrão do Next, com o título 404.
  await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lista de usuários' })).toHaveCount(0);
});

test(
  'quem gere acessos gera um link de recuperação para outro usuário',
  { tag: '@KAN-13-CA6' },
  async ({ page, browser, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const manager = await createTestUser({ managesAccess: true });
    const other = await createTestUser();
    await signIn(page.context(), manager, baseURL ?? '');

    await page.goto('/');
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByRole('menuitem', { name: 'Usuários e acessos' }).click();
    // A lista mostra a primeira página de um banco com os usuários de outras execuções: busca o outro.
    const list = page.getByRole('region', { name: 'Lista de usuários' });
    await list.getByRole('searchbox', { name: 'Buscar usuário' }).fill(other.email);
    await list.getByRole('link', { name: new RegExp(other.name) }).click();
    const detail = page.getByRole('region', { name: other.name });
    await expect(detail.getByText(other.email)).toBeVisible();

    await detail.getByRole('button', { name: 'Gerar link de recuperação' }).click();

    const generated = detail.getByRole('status');
    await expect(generated).toContainText('Link de recuperação gerado');
    await expect(generated).toContainText(/Vale até \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    const field = generated.getByRole('textbox', { name: 'Link de recuperação' });
    await expect(field).toHaveValue(/\/set-password\/[A-Za-z0-9_-]+$/);
    await expect(generated.getByRole('button', { name: 'Copiar link' })).toBeVisible();

    const link = new URL(await field.inputValue());
    const anonymous = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': uniqueOrigin() } });
    try {
      const setPassword = await anonymous.newPage();
      await setPassword.goto(`${baseURL ?? ''}${link.pathname}`);
      await expect(setPassword.getByRole('heading', { name: 'Defina sua senha' })).toBeVisible();
      await expect(setPassword.getByText(`Link de uso único para ${other.email}.`)).toBeVisible();
    } finally {
      await anonymous.close();
    }
  },
);
