import { expect, test } from '@playwright/test';

import { openTestCompany } from './support/entities';
import { openTestUser, uniqueOrigin } from './support/users';

// A confirmação abre pelo teclado, com o botão focado e o Enter: é o caminho de quem depende da volta
// do foco, e o único em que todo navegador foca o botão antes de abrir.

test(
  'fechar a confirmação com o Esc devolve o foco ao botão que a abriu',
  { tag: '@KAN-21-CA1' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const entity = await openTestCompany(page, baseURL ?? '');
    const detail = page.getByRole('region', { name: entity.name });
    const trigger = detail.getByRole('button', { name: 'Desativar entidade' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    const confirmation = page.getByRole('alertdialog', { name: `Desativar a ${entity.name}?` });
    await expect(confirmation).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(confirmation).toHaveCount(0);
    await expect(trigger).toBeFocused();
  },
);

test(
  'cancelar a confirmação devolve o foco ao botão que a abriu',
  { tag: '@KAN-21-CA2' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await openTestUser(page, baseURL ?? '');
    const detail = page.getByRole('region', { name: user.name });
    const trigger = detail.getByRole('button', { name: 'Desativar usuário' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    const confirmation = page.getByRole('alertdialog', { name: `Desativar ${user.name}?` });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancelar' }).click();

    await expect(confirmation).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // O estado vem do servidor: recarregada, a página mostra o usuário ainda ativo.
    await page.reload();
    await expect(detail.getByRole('button', { name: 'Desativar usuário' })).toBeVisible();
    await expect(detail.getByText('Desativado')).toHaveCount(0);
  },
);

// Sem critério de aceite: o caminho de confirmar, em que o botão fica desabilitado enquanto a ação roda.
test('confirmar devolve o foco ao botão que a abriu, quando a ação termina', async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const entity = await openTestCompany(page, baseURL ?? '');
  const detail = page.getByRole('region', { name: entity.name });

  await detail.getByRole('button', { name: 'Desativar entidade' }).focus();
  await page.keyboard.press('Enter');
  const confirmation = page.getByRole('alertdialog', { name: `Desativar a ${entity.name}?` });
  await confirmation.getByRole('button', { name: 'Desativar entidade' }).click();

  await expect(confirmation).toHaveCount(0);
  await expect(detail).toContainText('Desativada');
  await expect(detail.getByRole('button', { name: 'Reativar entidade' })).toBeFocused();
});
