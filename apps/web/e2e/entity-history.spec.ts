import { expect, test } from '@playwright/test';

import { createTestCompany, uniqueName } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

test(
  'na tela da entidade, o usuário abre o histórico e vê a alteração que acabou de fazer',
  { tag: '@KAN-16-CA3' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    const oldName = uniqueName('Clínica Histórico');
    const newName = `${oldName} Renomeada`;
    const company = await createTestCompany(user, oldName);
    await signIn(page.context(), user, baseURL ?? '');
    const detail = page.getByRole('region', { name: newName });

    await page.goto(`/entities/${company.id}`);
    await page.getByRole('link', { name: 'Editar dados' }).click();
    await page.getByLabel('Nome').fill(newName);
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(detail.getByRole('heading', { level: 2, name: newName })).toBeVisible();

    const opener = detail.getByRole('button', { name: 'Histórico' });
    await opener.click();
    const panel = page.getByRole('dialog', { name: 'Histórico de alterações' });
    await expect(panel).toContainText(`${newName} · entidade`);
    const changes = panel.getByRole('listitem');
    await expect(changes.first()).toContainText(`${user.name} alterou`);
    await expect(changes.first()).toContainText(`Nome: ${oldName} → ${newName}`);
    await expect(changes.last()).toContainText(`${user.name} criou a entidade`);
    await expect(panel).toContainText('O histórico vem da auditoria e não pode ser alterado.');

    await panel.getByRole('button', { name: 'Fechar o histórico' }).click();
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();

    await opener.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
  },
);
