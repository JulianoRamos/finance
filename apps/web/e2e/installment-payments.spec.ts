import { expect, test } from '@playwright/test';

import { createTestAccount, daysAgo } from './support/accounts';
import { createTestIndividual, postAsUser, uniqueName } from './support/entities';
import { shown } from './support/entries';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

test(
  'o usuário registra uma receita já paga, paga uma parcela vencida e desfaz o pagamento',
  { tag: '@KAN-29-CA5' },
  async ({ page, baseURL }) => {
    // Larga o bastante para o detalhe mostrar a tabela das parcelas, com o menu de cada uma.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    const person = await createTestIndividual(user, uniqueName('Ana Pagamentos'));
    const account = await createTestAccount(user, person, {
      openingBalance: '1000.00',
      openingBalanceDate: daysAgo(30),
    });
    const category = (name: string, nature: 'expense' | 'revenue') =>
      postAsUser(user, '/v1/categories', { name: uniqueName(name), nature }, 'da categoria de teste');
    const revenue = await category('Vendas E2E', 'revenue');
    const expenseCategory = await category('Casa E2E', 'expense');
    const expenseDescription = uniqueName('Geladeira E2E');
    const expense = await postAsUser(
      user,
      '/v1/entries',
      {
        entityId: person.id,
        type: 'expense',
        description: expenseDescription,
        categoryId: expenseCategory.id,
        purpose: 'household',
        occurredOn: daysAgo(10),
        totalAmount: '400.00',
        installmentCount: 2,
        firstDueDate: daysAgo(5),
        accountId: account.id,
      },
      'do lançamento de teste',
    );
    await signIn(page.context(), user, baseURL ?? '');
    await page
      .context()
      .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL ?? '', httpOnly: true }]);
    const today = daysAgo(0);
    const description = uniqueName('Bicicleta E2E');

    await page.goto('/entries/new');
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    await form.getByRole('radio', { name: 'Receita' }).check();
    await form.getByLabel('Descrição').fill(description);
    await form.getByLabel('Valor total (R$)').fill('250,00');
    await form.getByRole('button', { name: 'Hoje' }).first().click();
    await form.getByLabel('Categoria').selectOption({ label: revenue.name });
    await form.getByLabel('Recebimento').fill(today);
    await form.getByLabel('Conta', { exact: true }).selectOption({ label: account.name });
    await form.getByRole('checkbox', { name: /Já pago/ }).check();
    await expect(form.getByLabel('Conta do pagamento')).toHaveValue(account.id);
    await expect(form.getByLabel('Data do pagamento')).toHaveValue(today);
    await form.getByRole('button', { name: 'Registrar lançamento' }).click();

    const paid = page.getByRole('region', { name: description });
    await expect(paid.getByRole('table').getByRole('row').nth(1)).toContainText('Liquidada');
    await page.goto(`/accounts/${account.id}`);
    await expect(page.getByRole('group', { name: 'Saldo hoje' })).toContainText('R$ 1.250,00');

    await page.goto(`/entries/${expense.id}`);
    const detail = page.getByRole('region', { name: expenseDescription });
    const first = detail.getByRole('table').getByRole('row').nth(1);
    await expect(first).toContainText('Vencida');
    await first.getByRole('button', { name: 'Ações da parcela 1' }).click();
    await page.getByRole('menuitem', { name: 'Marcar como paga' }).click();
    const dialog = page.getByRole('dialog', { name: 'Marcar a parcela 1 como paga' });
    await dialog.getByRole('button', { name: 'Marcar como paga' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(first).toContainText('Liquidada');
    await expect(first).toContainText(`Pago em ${shown(today)}`);

    await first.getByRole('button', { name: 'Ações da parcela 1' }).click();
    await page.getByRole('menuitem', { name: 'Desfazer pagamento' }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Desfazer o pagamento da parcela 1?' });
    await confirmation.getByRole('button', { name: 'Desfazer pagamento' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(first).toContainText('Vencida');
  },
);
