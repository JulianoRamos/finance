import { expect, type Page, test } from '@playwright/test';

import { createTestCompany, createTestGroup, createTestIndividual, uniqueName } from './support/entities';
import { createTestUser, signIn, uniqueOrigin } from './support/users';

/** O botão do seletor de contexto, na barra lateral. */
function selectorButton(page: Page) {
  return page.getByRole('button', { name: /^Contexto: / });
}

/** Abre o seletor e devolve o painel dele. */
async function openSelector(page: Page) {
  await selectorButton(page).click();
  const panel = page.getByRole('dialog', { name: 'Contexto financeiro' });
  await expect(panel).toBeVisible();
  return panel;
}

test(
  'o seletor lista, pela busca na api, os contextos em que o usuário tem permissão',
  { tag: '@KAN-14-CA1' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const prefix = uniqueName('Ctx');
    const user = await createTestUser();
    const person = await createTestIndividual(user, `${prefix} Pessoa`);
    const company = await createTestCompany(user, `${prefix} Empresa`);
    const group = await createTestGroup(user, [person, company], `${prefix} Grupo`);
    const other = await createTestUser();
    const otherCompany = await createTestCompany(other, `${prefix} Empresa Alheia`);
    const otherGroup = await createTestGroup(other, [otherCompany], `${prefix} Grupo Alheio`);
    const many = uniqueName('Muitas');
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) await createTestIndividual(user, `${many} ${letter}`);
    await signIn(page.context(), user, baseURL ?? '');
    await page.goto('/');

    const panel = await openSelector(page);
    const search = panel.getByRole('searchbox', { name: 'Buscar entidade ou grupo' });
    await search.fill(prefix);

    const groups = panel.getByRole('group', { name: 'Grupos' });
    const individuals = panel.getByRole('group', { name: 'Pessoas físicas' });
    const companies = panel.getByRole('group', { name: 'Empresas' });
    await expect(groups.getByRole('button', { name: group.name, exact: true })).toBeVisible();
    await expect(individuals.getByRole('button', { name: person.name, exact: true })).toBeVisible();
    await expect(companies.getByRole('button', { name: company.name, exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: otherCompany.name, exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: otherGroup.name, exact: true })).toHaveCount(0);

    await search.fill(many);

    await expect(individuals.getByRole('button', { name: new RegExp(many) })).toHaveCount(5);
    await expect(individuals).toContainText('Mais 1. Refine a busca.');
  },
);

/** O cartão do contexto no Início: o título dele é o nome do contexto. */
function homeContext(page: Page, name: string) {
  return page.getByRole('main').getByRole('heading', { level: 2, name, exact: true });
}

test(
  'a escolha do contexto vale quando o usuário volta ao sistema',
  { tag: '@KAN-14-CA2' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const user = await createTestUser();
    // A pessoa física vem antes da empresa no seletor: sem a escolha guardada, a empresa não é o contexto.
    await createTestIndividual(user);
    const company = await createTestCompany(user);
    await signIn(page.context(), user, baseURL ?? '');
    await page.goto('/');
    await expect(selectorButton(page)).not.toContainText(company.name);

    const panel = await openSelector(page);
    await panel.getByRole('searchbox', { name: 'Buscar entidade ou grupo' }).fill(company.name);
    await panel.getByRole('button', { name: company.name, exact: true }).click();

    await expect(selectorButton(page)).toContainText(company.name);
    await expect(homeContext(page, company.name)).toBeVisible();

    await page.getByRole('button', { name: user.name }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');
    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Senha', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/');
    await expect(selectorButton(page)).toContainText(company.name);
    await expect(homeContext(page, company.name)).toBeVisible();
  },
);

/** Escolhe no seletor o contexto do nome dado, buscado pela api. */
async function chooseContext(page: Page, name: string) {
  const panel = await openSelector(page);
  await panel.getByRole('searchbox', { name: 'Buscar entidade ou grupo' }).fill(name);
  await panel.getByRole('button', { name, exact: true }).click();
  await expect(selectorButton(page)).toContainText(name);
}

test(
  'o Início mostra o contexto escolhido e as entidades que ele reúne',
  { tag: '@KAN-14-CA5' },
  async ({ page, baseURL }) => {
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
    const prefix = uniqueName('Inicio');
    const user = await createTestUser();
    const person = await createTestIndividual(user, `${prefix} Pessoa`);
    const company = await createTestCompany(user, `${prefix} Empresa`);
    const group = await createTestGroup(user, [person, company], `${prefix} Grupo`);
    await signIn(page.context(), user, baseURL ?? '');
    await page.goto('/');
    const main = page.getByRole('main');
    const entities = main.getByRole('list', { name: 'Entidades do contexto' });

    await chooseContext(page, group.name);

    await expect(homeContext(page, group.name)).toBeVisible();
    await expect(main.getByText('Grupo', { exact: true })).toBeVisible();
    await expect(main.getByText('Este contexto reúne 1 pessoa física e 1 empresa.')).toBeVisible();
    await expect(entities.getByRole('listitem')).toHaveText([
      new RegExp(`^${company.name}\\s*PJ$`),
      new RegExp(`^${person.name}\\s*PF$`),
    ]);

    await chooseContext(page, person.name);

    await expect(homeContext(page, person.name)).toBeVisible();
    await expect(main.getByText('Pessoa física', { exact: true })).toBeVisible();
    await expect(entities.getByRole('listitem')).toHaveText([new RegExp(`^${person.name}\\s*PF$`)]);
  },
);
