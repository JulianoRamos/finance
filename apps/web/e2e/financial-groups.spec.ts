import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  createTestCompany,
  createTestGroup,
  createTestIndividual,
  deleteTestGroup,
  type TestEntity,
  uniqueName,
} from './support/entities';
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

/**
 * Busca a entidade entre os membros do formulário, quando há a busca (mais de 10 entidades): o banco de
 * desenvolvimento guarda as de outras execuções, e a do teste pode ficar fora da primeira página.
 */
async function findMember(scope: Locator, name: string): Promise<void> {
  const search = scope.getByRole('searchbox', { name: 'Buscar entidade' });
  if ((await search.count()) > 0) await search.fill(name);
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
  await findMember(detail, company.name);
  await expect(companyBox).toBeDisabled();
  await expect(companyBox).toHaveAccessibleDescription('Empresa: não entra na Visão Familiar');
  const before = await familyViewCount(page);

  await findMember(detail, person.name);
  await personBox.check();
  await detail.getByRole('button', { name: 'Salvar membros' }).click();
  await expect(groupList(page).getByRole('link', { name: /^Visão Familiar/ })).not.toContainText(
    before === 0 ? 'Nenhuma' : `${String(before)} pessoa`,
  );
  await page.reload();
  await findMember(detail, person.name);

  await expect(personBox).toBeChecked();
  expect(await familyViewCount(page)).toBe(before + 1);

  // Tira a pessoa que pôs, para a Visão Familiar do banco de desenvolvimento não acumular as dos testes.
  await personBox.uncheck();
  await detail.getByRole('button', { name: 'Salvar membros' }).click();
  await expect(groupList(page).getByRole('link', { name: /^Visão Familiar/ })).toContainText(
    before === 0 ? 'Nenhuma pessoa física' : `${String(before)} pessoa`,
  );
  await page.reload();
  await findMember(detail, person.name);

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
  const newForm = page.getByRole('form', { name: 'Novo grupo financeiro' });
  await newForm.getByLabel('Nome', { exact: true }).fill(name);
  await findMember(newForm, person.name);
  await newForm.getByRole('checkbox', { name: person.name }).check();
  await findMember(newForm, company.name);
  await newForm.getByRole('checkbox', { name: company.name }).check();
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  // A lista mostra a primeira página de um banco com os grupos de outras execuções: busca o novo.
  const search = groupList(page).getByRole('searchbox', { name: 'Buscar grupo' });
  await expect(form(name)).toBeVisible();
  await search.fill(name);

  await expect(item(name)).toHaveAttribute('aria-current', 'page');
  await expect(item(name)).toContainText(`${person.name} e ${company.name}`);
  await expect(form(name).getByLabel('Nome', { exact: true })).toHaveValue(name);
  await findMember(form(name), person.name);
  await expect(form(name).getByRole('checkbox', { name: person.name })).toBeChecked();
  await findMember(form(name), company.name);
  await expect(form(name).getByRole('checkbox', { name: company.name })).toBeChecked();

  await form(name).getByLabel('Nome', { exact: true }).fill(newName);
  await form(name).getByRole('checkbox', { name: company.name }).uncheck();
  await form(name).getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(form(newName)).toBeVisible();
  await search.fill(newName);

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

test(
  'a lista dos grupos e a escolha dos membros paginam e buscam pela api',
  { tag: '@KAN-19-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    // Um prefixo só deste teste: o banco de desenvolvimento guarda os registros de outras execuções.
    const prefix = uniqueName('Busca');
    const groups: TestEntity[] = [];
    for (let index = 1; index <= 12; index += 1) {
      groups.push(await createTestGroup(user, [], `${prefix} Grupo ${String(index).padStart(2, '0')}`));
      await createTestIndividual(user, `${prefix} Pessoa ${String(index).padStart(2, '0')}`);
    }
    await signIn(page.context(), user, baseURL ?? '');
    const list = groupList(page);
    const groupSearch = list.getByRole('searchbox', { name: 'Buscar grupo' });
    const items = list.getByRole('link', { name: new RegExp(prefix) });
    const form = page.getByRole('form', { name: 'Novo grupo financeiro' });
    const memberSearch = form.getByRole('searchbox', { name: 'Buscar entidade' });
    const members = form.getByRole('checkbox', { name: new RegExp(prefix) });
    const firstPerson = form.getByRole('checkbox', { name: `${prefix} Pessoa 01` });
    const lastPerson = form.getByRole('checkbox', { name: `${prefix} Pessoa 12` });
    const nextMembers = form.getByRole('button', { name: 'Próxima página' });
    const name = `${prefix} Novo`;

    await page.goto('/financial-groups');
    await groupSearch.fill(prefix.toLowerCase());
    await expect(list).toContainText('1–10 de 12');
    await expect(items).toHaveCount(10);
    await list.getByRole('button', { name: 'Próxima página' }).click();
    await expect(list).toContainText('11–12 de 12');
    await expect(items).toHaveCount(2);

    await page.getByRole('link', { name: 'Novo grupo' }).click();
    await memberSearch.fill(prefix);
    await expect(form).toContainText('1–10 de 12');
    await expect(members).toHaveCount(10);
    await firstPerson.check();
    await nextMembers.click();
    await expect(members).toHaveCount(2);
    await lastPerson.check();
    await memberSearch.fill(`${prefix} Pessoa 05`);
    await expect(members).toHaveCount(1);
    await memberSearch.fill(prefix);
    await expect(firstPerson).toBeChecked();
    await nextMembers.click();
    await expect(lastPerson).toBeChecked();
    await form.getByLabel('Nome', { exact: true }).fill(name);
    await form.getByRole('button', { name: 'Criar grupo' }).click();

    await expect(page).toHaveURL(/\/financial-groups\/[0-9a-f-]{36}$/);
    await groupSearch.fill(name);
    await expect(list.getByRole('link', { name: new RegExp(`^${name}`) })).toContainText(
      `${prefix} Pessoa 01 e ${prefix} Pessoa 12`,
    );

    const id = /\/financial-groups\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? '';
    for (const group of [...groups, { id }]) await deleteTestGroup(user, group.id);
  },
);
