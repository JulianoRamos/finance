import { expect, test } from '@playwright/test';

import { createTestGroup, createTestIndividual, deleteTestGroup, uniqueName } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

test('o usuário cadastra, edita e desativa uma conta', { tag: '@KAN-23-CA7' }, async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  const person = await createTestIndividual(user, uniqueName('Ana Contas'));
  await signIn(page.context(), user, baseURL ?? '');
  await page
    .context()
    .addCookies([{ name: 'financial_context', value: `entity:${person.id}`, url: baseURL ?? '', httpOnly: true }]);
  const name = uniqueName('Nubank E2E');
  const newName = `${name} Renomeada`;
  const list = page.getByRole('region', { name: 'Lista de contas' });
  const detail = page.getByRole('region', { name: newName }).or(page.getByRole('region', { name }));

  await page.goto('/');
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Contas' }).click();
  // O primeiro é o do cabeçalho; sem nenhuma conta, o estado vazio traz outro.
  await page.getByRole('link', { name: 'Nova conta' }).first().click();
  await page.getByLabel('Entidade').selectOption({ label: person.name });
  await page.getByLabel('Nome').fill(name);
  await page.getByRole('radio', { name: /Conta corrente/ }).check();
  await page.getByLabel('Banco').selectOption({ label: 'Nubank' });
  await page.getByRole('checkbox', { name: /Conta de reserva/ }).check();
  await page.getByLabel('Saldo inicial (R$)').fill('1.234,56');
  await page.getByLabel('Data do saldo inicial').fill('2026-09-01');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(detail.getByRole('heading', { level: 2, name })).toBeVisible();
  await expect(detail).toContainText(`Conta corrente · Nubank · ${person.name}`);
  await expect(detail).toContainText('R$ 1.234,56');
  await expect(detail).toContainText('em 01/09/2026');
  const item = list.getByRole('link', { name: new RegExp(name) });
  await expect(item).toContainText('Reserva');
  await expect(item).toContainText(`${person.name} · Nubank`);

  await detail.getByRole('link', { name: 'Editar dados' }).click();
  await page.getByLabel('Nome').fill(newName);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(detail.getByRole('heading', { level: 2, name: newName })).toBeVisible();
  const renamed = list.getByRole('link', { name: new RegExp(newName) });
  await expect(renamed).toBeVisible();

  const trigger = detail.getByRole('button', { name: 'Desativar conta' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const confirmation = page.getByRole('alertdialog', { name: `Desativar a conta ${newName}?` });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Desativar conta' }).click();

  await expect(confirmation).toHaveCount(0);
  await expect(detail).toContainText('Esta conta está desativada');
  await expect(renamed).toContainText('Desativada');
  await expect(detail.getByRole('button', { name: 'Reativar conta' })).toBeFocused();
});

// Sem critério de aceite: depois de um envio recusado, as escolhas voltam com o que foi enviado. O contexto é
// um grupo, com duas entidades, para a entidade não vir já escolhida.
test('a recusa do cadastro mantém a entidade e o banco escolhidos', async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  const person = await createTestIndividual(user, uniqueName('Ana Recusa'));
  const group = await createTestGroup(user, [person, await createTestIndividual(user)]);
  try {
    await signIn(page.context(), user, baseURL ?? '');
    await page
      .context()
      .addCookies([{ name: 'financial_context', value: `group:${group.id}`, url: baseURL ?? '', httpOnly: true }]);

    await page.goto('/accounts/new');
    await page.getByLabel('Entidade').selectOption({ label: person.name });
    await page.getByLabel('Banco').selectOption({ label: 'Itaú' });
    await page.getByRole('radio', { name: /Conta corrente/ }).check();
    await page.getByLabel('Saldo inicial (R$)').fill('10');
    await page.getByLabel('Data do saldo inicial').fill('2026-09-01');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText(/Informe o nome/)).toBeVisible();
    await expect(page.getByLabel('Entidade')).toHaveValue(person.id);
    await expect(page.getByLabel('Banco')).toHaveValue('itau');
    await expect(page.getByRole('radio', { name: /Conta corrente/ })).toBeChecked();
  } finally {
    await deleteTestGroup(user, group.id);
  }
});

// Sem critério de aceite: num contexto sem entidade ativa, a nova conta diz por que não há o que escolher.
test('a nova conta num contexto sem entidade ativa pede para trocar o contexto', async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  const group = await createTestGroup(user, []);
  try {
    await signIn(page.context(), user, baseURL ?? '');
    await page
      .context()
      .addCookies([{ name: 'financial_context', value: `group:${group.id}`, url: baseURL ?? '', httpOnly: true }]);

    await page.goto('/accounts/new');

    await expect(page.getByText('O contexto escolhido não tem nenhuma entidade ativa.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);
    await page.getByRole('main').getByRole('button', { name: 'Trocar o contexto' }).click();
    await expect(page.getByRole('dialog', { name: 'Contexto financeiro' })).toBeVisible();
  } finally {
    await deleteTestGroup(user, group.id);
  }
});
