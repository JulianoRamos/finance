import { expect, test } from '@playwright/test';

import { createTestAccount, daysAgo } from './support/accounts';
import { createTestIndividual, postAsUser, uniqueName } from './support/entities';
import { shown } from './support/entries';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

/** A data `AAAA-MM-DD` `months` meses depois, no mesmo dia, ou no último dia do mês que não o tem. */
function monthsAfter(date: string, months: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

test(
  'o usuário registra uma despesa parcelada, vê a prévia e acha as parcelas',
  { tag: '@KAN-28-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    const person = await createTestIndividual(user, uniqueName('Ana Lançamentos'));
    const account = await createTestAccount(user, person);
    const category = await postAsUser(
      user,
      '/v1/categories',
      { name: uniqueName('Móveis E2E'), nature: 'expense' },
      'da categoria de teste',
    );
    await signIn(page.context(), user, baseURL ?? '');
    await page
      .context()
      .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL ?? '', httpOnly: true }]);
    const description = uniqueName('Sofá E2E');
    const today = daysAgo(0);

    await page.goto('/');
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Lançamentos' }).click();
    // O primeiro é o do cabeçalho; sem nenhum lançamento no mês, o estado vazio traz outro.
    await page.getByRole('link', { name: 'Novo lançamento' }).first().click();
    const form = page.getByRole('form', { name: 'Novo lançamento' });
    await form.getByRole('radio', { name: 'Despesa' }).check();
    await expect(form.getByLabel('Entidade')).toHaveValue(person.id);
    await form.getByLabel('Descrição').fill(description);
    await form.getByLabel('Valor total (R$)').fill('1.000,00');
    await form.getByRole('button', { name: 'Hoje' }).click();
    await form.getByLabel('Categoria').selectOption({ label: category.name });
    await form.getByRole('radio', { name: 'Familiar' }).check();
    await form.getByRole('radio', { name: 'Parcelado' }).check();
    await form.getByLabel('Número de parcelas').fill('3');
    await form.getByLabel('Primeiro vencimento').fill(today);
    await form.getByLabel('Conta', { exact: true }).selectOption({ label: account.name });

    const preview = form.getByRole('list', { name: 'Prévia das parcelas' });
    await expect(preview.getByRole('listitem')).toHaveText([
      `1ª parcela${shown(today)}R$ 333,34`,
      `2ª parcela${shown(monthsAfter(today, 1))}R$ 333,33`,
      `3ª parcela${shown(monthsAfter(today, 2))}R$ 333,33`,
    ]);

    await form.getByRole('button', { name: 'Registrar lançamento' }).click();

    const detail = page.getByRole('region', { name: description });
    await expect(detail.getByRole('heading', { level: 2, name: description })).toBeVisible();
    const item = page
      .getByRole('region', { name: 'Lista de lançamentos' })
      .getByRole('link', { name: new RegExp(description) });
    await expect(item).toContainText('parcela 1 de 3');
    // Ao lado da lista, o Conteúdo é estreito, e a tabela das parcelas vira a lista (design-system.md, 4.4).
    const installments = detail
      .getByRole('list', { name: `Parcelas do lançamento ${description}` })
      .getByRole('listitem');
    await expect(installments).toHaveText([
      `1 de 3Saída: − R$ 333,34${shown(today)} · ${account.name}Prevista`,
      `2 de 3Saída: − R$ 333,33${shown(monthsAfter(today, 1))} · ${account.name}Prevista`,
      `3 de 3Saída: − R$ 333,33${shown(monthsAfter(today, 2))} · ${account.name}Prevista`,
    ]);
  },
);
