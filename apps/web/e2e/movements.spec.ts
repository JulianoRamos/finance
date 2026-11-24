import { expect, test } from '@playwright/test';

import { daysAgo, openTestAccount } from './support/accounts';
import { uniqueName } from './support/entities';
import { uniqueOrigin } from './support/users';

test(
  'o usuário registra uma saída e uma entrada e vê os saldos mudarem',
  { tag: '@KAN-24-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const { name } = await openTestAccount(page, baseURL ?? '', undefined, {
      account: { name: uniqueName('Nubank Movimentos'), openingBalance: '1000.00', openingBalanceDate: daysAgo(10) },
    });
    const detail = page.getByRole('region', { name });
    const today = detail.getByRole('group', { name: 'Saldo hoje' });
    const listItem = page
      .getByRole('region', { name: 'Lista de contas' })
      .getByRole('link', { name: new RegExp(name) });
    const movements = detail.getByRole('region', { name: 'Movimentações' });
    const dialog = page.getByRole('dialog', { name: `Nova movimentação em ${name}` });

    await expect(today).toContainText('R$ 1.000,00');

    await movements.getByRole('button', { name: 'Nova movimentação' }).click();
    await dialog.getByRole('radio', { name: 'Saída' }).check();
    await dialog.getByLabel('Data').fill(daysAgo(0));
    await dialog.getByLabel('Valor (R$)').fill('200,00');
    await dialog.getByLabel('Descrição').fill('Mercado do bairro');
    await dialog.getByRole('button', { name: 'Registrar movimentação' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(movements.getByText('Mercado do bairro').first()).toBeVisible();
    await expect(movements).toContainText('Saída: − R$ 200,00');
    await expect(today).toContainText('R$ 800,00');
    await expect(listItem).toContainText('R$ 800,00');

    const earlier = daysAgo(2);
    await movements.getByRole('button', { name: 'Nova movimentação' }).click();
    await dialog.getByRole('radio', { name: 'Entrada' }).check();
    await dialog.getByLabel('Data').fill(earlier);
    await dialog.getByLabel('Valor (R$)').fill('50,00');
    await dialog.getByLabel('Descrição').fill('Reembolso');
    await dialog.getByRole('button', { name: 'Registrar movimentação' }).click();
    await expect(dialog).toHaveCount(0);

    const onDate = detail.getByRole('group', { name: 'Saldo em' });
    await onDate.getByLabel('Saldo em').fill(earlier);
    // Nos primeiros dias do mês, o padrão do campo (o fim do mês anterior) já daria o mesmo saldo: o
    // endereço com a data escolhida prova que o saldo é o dela.
    await expect(page).toHaveURL(new RegExp(`balanceDate=${earlier}`));

    await expect(today).toContainText('R$ 850,00');
    await expect(listItem).toContainText('R$ 850,00');
    await expect(onDate).toContainText('R$ 1.050,00');
  },
);
