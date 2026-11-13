import { expect, test } from '@playwright/test';

import { createTestCompany } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';
import { formatCnpj, uniqueCnpj } from './support/tax-ids';

test('o usuário cadastra, edita e desativa uma entidade', { tag: '@KAN-11-CA5' }, async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  await signIn(page.context(), await createTestUser(), baseURL ?? '');
  const cnpj = uniqueCnpj();
  const name = `Clínica E2E ${crypto.randomUUID().slice(0, 8)}`;
  const newName = `${name} Renomeada`;
  const list = page.getByRole('region', { name: 'Lista de entidades' });
  const detail = page.getByRole('region', { name: newName }).or(page.getByRole('region', { name }));

  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('menuitem', { name: 'Entidades' }).click();
  // O primeiro é o do cabeçalho; sem nenhuma entidade, o estado vazio traz outro.
  await page.getByRole('link', { name: 'Nova entidade' }).first().click();
  await page.getByRole('radio', { name: /Pessoa jurídica/ }).check();
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('CNPJ (opcional)').fill(cnpj);
  await page.getByRole('checkbox', { name: /Clínica/ }).check();
  await page.getByRole('button', { name: 'Criar entidade' }).click();

  await expect(detail.getByRole('heading', { level: 2, name })).toBeVisible();
  await expect(detail).toContainText(`Pessoa jurídica · ${formatCnpj(cnpj)}`);
  await expect(detail.getByRole('switch', { name: 'Clínica' })).toBeChecked();
  const item = list.getByRole('link', { name: new RegExp(name) });
  await expect(item).toContainText('PJ');
  await expect(item).toContainText('Operação: Clínica');

  await detail.getByRole('link', { name: 'Editar dados' }).click();
  await page.getByLabel('Nome').fill(newName);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(detail.getByRole('heading', { level: 2, name: newName })).toBeVisible();
  const renamed = list.getByRole('link', { name: new RegExp(newName) });
  await expect(renamed).toBeVisible();

  await detail.getByRole('button', { name: 'Desativar entidade' }).click();
  const confirmation = page.getByRole('alertdialog', { name: `Desativar a ${newName}?` });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Desativar entidade' }).click();

  await expect(detail).toContainText('Desativada');
  await expect(detail.getByRole('button', { name: 'Reativar entidade' })).toBeVisible();
  await expect(renamed).toContainText('Desativada');
});

test('a busca filtra a lista, que mostra 10 entidades por vez', async ({ page, baseURL }) => {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  // Um prefixo só deste teste: o banco de desenvolvimento guarda as entidades de outras execuções.
  const prefix = `Busca ${crypto.randomUUID().slice(0, 8)}`;
  let last = { id: '' };
  for (let index = 1; index <= 12; index += 1) {
    last = await createTestCompany(user, `${prefix} ${String(index).padStart(2, '0')}`);
  }
  await signIn(page.context(), user, baseURL ?? '');
  const list = page.getByRole('region', { name: 'Lista de entidades' });
  const items = list.getByRole('link', { name: new RegExp(prefix) });

  await page.goto('/entities/new');
  await list.getByRole('searchbox', { name: 'Buscar entidade' }).fill(prefix.toLowerCase());

  await expect(items).toHaveCount(10);
  await list.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(items).toHaveCount(12);
  await expect(list.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0);

  await list.getByRole('searchbox', { name: 'Buscar entidade' }).fill(`${prefix} 12`);
  await expect(items).toHaveCount(1);
  await list.getByRole('searchbox', { name: 'Buscar entidade' }).fill(`${prefix} 99`);
  await expect(list).toContainText('Nenhuma entidade encontrada.');

  // A entidade aberta depois da primeira página entra no fim da lista, e não traz as do meio.
  await page.goto(`/entities/${last.id}`);
  await list.getByRole('searchbox', { name: 'Buscar entidade' }).fill(prefix);
  await expect(items).toHaveCount(11);
  await expect(items.last()).toHaveAttribute('aria-current', 'page');
});

test('chegar a Entidades pelo menu ou pelo Cancelar abre a primeira entidade, sem erro na página', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const user = await createTestUser();
  // Garante uma entidade para abrir, mesmo num banco sem nenhuma.
  await createTestCompany(user);
  await signIn(page.context(), user, baseURL ?? '');
  const opened = /\/entities\/[0-9a-f-]{36}$/;

  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('menuitem', { name: 'Entidades' }).click();
  await expect(page).toHaveURL(opened);
  await page.getByRole('link', { name: 'Nova entidade' }).first().click();
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(opened);

  expect(errors).toEqual([]);
});
