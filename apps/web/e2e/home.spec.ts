import { expect, test } from '@playwright/test';

import { createTestUser, signIn } from './support/users';

test('a página inicial mostra o estado da API', { tag: '@KAN-7-CA2' }, async ({ page, context, baseURL }) => {
  // A página inicial exige uma sessão.
  await signIn(context, await createTestUser(), baseURL ?? '');

  // O estado vem renderizado no servidor da web: já está no HTML, antes de qualquer script do navegador.
  const html = await (await page.request.get('/')).text();
  expect(html).toContain('API no ar');

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'finance' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API no ar');
});
