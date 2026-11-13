import { expect, type Locator, type Page, test } from '@playwright/test';

import { createTestCompany, createTestIndividual, uniqueName } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

/** A lista dos grupos. */
function groupList(page: Page): Locator {
  return page.getByRole('region', { name: 'Lista de grupos' });
}

/** Quantas pessoas físicas a segunda linha da Visão Familiar conta na lista. */
async function familyViewCount(page: Page): Promise<number> {
  const item = groupList(page).getByRole('link', { name: /^Visão Familiar/ });
  const text = (await item.textContent()) ?? '';
  if (text.includes('Nenhuma pessoa física')) return 0;
  const count = /(\d+) pessoas? físicas?/.exec(text)?.[1];
  if (count === undefined) throw new Error(`A Visão Familiar não conta as pessoas físicas: ${text}`);
  return Number(count);
}

test('o usuário escolhe os membros da Visão Familiar', { tag: '@KAN-12-CA4' }, async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  const person = await createTestIndividual(user, uniqueName('Ana E2E'));
  const company = await createTestCompany(user, uniqueName('Clínica E2E'));
  await signIn(page.context(), user, baseURL ?? '');
  const detail = page.getByRole('region', { name: 'Visão Familiar' });
  const personBox = detail.getByRole('checkbox', { name: person.name });

  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('menuitem', { name: 'Grupos financeiros' }).click();

  await expect(detail.getByRole('heading', { level: 2, name: 'Visão Familiar' })).toBeVisible();
  await expect(detail).toContainText('Só aceita pessoas físicas.');
  const companyBox = detail.getByRole('checkbox', { name: company.name });
  await expect(companyBox).toBeDisabled();
  await expect(companyBox).toHaveAccessibleDescription('Empresa: não entra na Visão Familiar');
  const before = await familyViewCount(page);

  await personBox.check();
  await detail.getByRole('button', { name: 'Salvar membros' }).click();
  await expect(groupList(page).getByRole('link', { name: /^Visão Familiar/ })).not.toContainText(
    before === 0 ? 'Nenhuma' : `${String(before)} pessoa`,
  );
  await page.reload();

  await expect(personBox).toBeChecked();
  expect(await familyViewCount(page)).toBe(before + 1);

  // Tira a pessoa que pôs, para a Visão Familiar do banco de desenvolvimento não acumular as dos testes.
  await personBox.uncheck();
  await detail.getByRole('button', { name: 'Salvar membros' }).click();
  await expect(groupList(page).getByRole('link', { name: /^Visão Familiar/ })).toContainText(
    before === 0 ? 'Nenhuma pessoa física' : `${String(before)} pessoa`,
  );
  await page.reload();

  await expect(personBox).not.toBeChecked();
});

test('o usuário cria, edita e exclui um grupo', { tag: '@KAN-12-CA7' }, async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  const person = await createTestIndividual(user, uniqueName('Ana E2E'));
  const company = await createTestCompany(user, uniqueName('Clínica E2E'));
  await signIn(page.context(), user, baseURL ?? '');
  const name = uniqueName('Grupo E2E');
  const newName = `${name} Renomeado`;
  const item = (groupName: string) => groupList(page).getByRole('link', { name: new RegExp(`^${groupName}`) });
  const form = (groupName: string) => page.getByRole('form', { name: groupName });

  await page.goto('/financial-groups');
  await page.getByRole('link', { name: 'Novo grupo' }).click();
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByRole('checkbox', { name: person.name }).check();
  await page.getByRole('checkbox', { name: company.name }).check();
  await page.getByRole('button', { name: 'Criar grupo' }).click();

  await expect(item(name)).toHaveAttribute('aria-current', 'page');
  await expect(item(name)).toContainText(`${person.name} e ${company.name}`);
  await expect(form(name).getByLabel('Nome', { exact: true })).toHaveValue(name);
  await expect(form(name).getByRole('checkbox', { name: person.name })).toBeChecked();
  await expect(form(name).getByRole('checkbox', { name: company.name })).toBeChecked();

  await form(name).getByLabel('Nome', { exact: true }).fill(newName);
  await form(name).getByRole('checkbox', { name: company.name }).uncheck();
  await form(name).getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(item(newName)).toBeVisible();
  await expect(item(newName)).toContainText(person.name);
  await expect(item(newName)).not.toContainText(company.name);

  await form(newName).getByRole('button', { name: 'Excluir grupo' }).click();
  const confirmation = page.getByRole('alertdialog', { name: `Excluir o grupo ${newName}?` });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Excluir grupo' }).click();

  await expect(item(newName)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Visão Familiar' })).toBeVisible();
});
