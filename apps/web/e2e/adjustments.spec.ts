import { expect, test } from '@playwright/test';

import { daysAgo, openTestAccount } from './support/accounts';
import { uniqueName } from './support/entities';
import { uniqueOrigin } from './support/users';

test(
  'o usuário ajusta o saldo ao do banco e vê o ajuste na conta',
  { tag: '@KAN-25-CA4' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const { name } = await openTestAccount(page, baseURL ?? '', undefined, {
      account: { name: uniqueName('Nubank Ajuste'), openingBalance: '1000.00', openingBalanceDate: daysAgo(10) },
    });
    const detail = page.getByRole('region', { name });
    const today = detail.getByRole('group', { name: 'Saldo hoje' });
    const movements = detail.getByRole('region', { name: 'Movimentações' });
    const dialog = page.getByRole('dialog', { name: `Ajustar o saldo de ${name}` });

    await detail.getByRole('button', { name: 'Ajustar saldo' }).click();
    await dialog.getByLabel('Data').fill(daysAgo(0));
    await dialog.getByLabel('Saldo no banco (R$)').fill('987,10');

    const summary = dialog.getByRole('definition');
    await expect(summary.nth(0)).toHaveText('R$ 1.000,00');
    await expect(summary.nth(1)).toHaveText('R$ 987,10');
    await expect(summary.nth(2)).toHaveText('Saída de R$ 12,90');

    await dialog.getByRole('button', { name: 'Registrar ajuste' }).click();
    const reason = dialog.getByLabel('Motivo');
    await expect(reason).toHaveAccessibleDescription('Diga por que o saldo difere do banco.');
    await expect(dialog).toBeVisible();

    await reason.fill('Tarifa não lançada');
    await dialog.getByRole('button', { name: 'Registrar ajuste' }).click();

    await expect(dialog).toHaveCount(0);
    // No detalhe ao lado da lista, a tabela vira a lista estreita, com a origem depois da data.
    const adjustment = movements.getByRole('listitem').filter({ hasText: 'Ajuste: Tarifa não lançada' });
    await expect(adjustment).toContainText('Saída: − R$ 12,90');
    await expect(adjustment).toContainText(/· Ajuste$/);
    await expect(today).toContainText('R$ 987,10');
  },
);
