import { expect, type Page, test } from '@playwright/test';

import { createTestIndividual, uniqueName } from './support/entities';
import { createTestUser, signIn, type TestUser, uniqueOrigin } from './support/users';

/** Entra com o usuário dado, ou com um novo, e abre o Início. */
async function startAt(page: Page, baseURL: string | undefined, user?: TestUser): Promise<TestUser> {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
  const signedIn = user ?? (await createTestUser());
  await signIn(page.context(), signedIn, baseURL ?? '');
  await page.goto('/');
  return signedIn;
}

/** O campo "Pesquisar…" da barra superior. */
function searchField(page: Page) {
  return page.getByRole('button', { name: 'Pesquisar', exact: true });
}

/** A paleta de pesquisa. */
function palette(page: Page) {
  return page.getByRole('dialog', { name: 'Pesquisar' });
}

/** O campo da paleta. */
function paletteInput(page: Page) {
  return palette(page).getByRole('combobox', { name: 'Pesquisar' });
}

test(
  'o usuário abre a paleta, pesquisa e abre um resultado pelo teclado',
  { tag: '@KAN-18-CA4' },
  async ({ page, baseURL }) => {
    const user = await createTestUser();
    const prefix = uniqueName('Pesquisa');
    const part = prefix.split(' ')[1] ?? '';
    await createTestIndividual(user, `${prefix} A`);
    const second = await createTestIndividual(user, `${prefix} B`);
    await startAt(page, baseURL, user);

    await searchField(page).click();

    await expect(paletteInput(page)).toBeFocused();
    await expect(palette(page).getByRole('group', { name: 'Ir para' })).toBeVisible();
    await expect(palette(page).getByRole('group', { name: 'Ações' })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(palette(page)).toBeHidden();
    await expect(searchField(page)).toBeFocused();

    await page.keyboard.press('Control+K');
    await expect(paletteInput(page)).toBeFocused();
    await paletteInput(page).fill(part);

    const entities = palette(page).getByRole('group', { name: 'Entidades' });
    const option = entities.getByRole('option', { name: second.name });
    await expect(option).toBeVisible();
    await expect(option.locator('mark')).toHaveText(part);

    await page.keyboard.press('ArrowDown');
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');

    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(`/entities/${second.id}`);
    await expect(page.getByRole('heading', { level: 2, name: second.name })).toBeVisible();
  },
);

test('as telas e as ações seguem o termo e as permissões', { tag: '@KAN-18-CA5' }, async ({ page, baseURL }) => {
  await startAt(page, baseURL);
  await searchField(page).click();
  const option = (name: string) => palette(page).getByRole('option', { name: new RegExp(`^${name}`) });

  await paletteInput(page).fill('usu');

  await expect(palette(page).getByRole('group', { name: 'Ir para' })).toBeHidden();
  await expect(option('Usuários e acessos')).toHaveCount(0);
  await expect(option('Novo usuário')).toHaveCount(0);

  await paletteInput(page).fill('grupo');

  await expect(
    palette(page)
      .getByRole('group', { name: 'Ir para' })
      .getByRole('option', { name: /^Grupos financeiros/ }),
  ).toBeVisible();
  await expect(
    palette(page)
      .getByRole('group', { name: 'Ações' })
      .getByRole('option', { name: /^Novo grupo financeiro/ }),
  ).toBeVisible();
  await expect(option('Entidades')).toHaveCount(0);
  await expect(option('Nova entidade')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await page.context().clearCookies();
  await startAt(page, baseURL, await createTestUser({ managesAccess: true }));
  await searchField(page).click();
  await paletteInput(page).fill('usu');

  await expect(option('Usuários e acessos')).toBeVisible();
  await option('Novo usuário').click();

  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL('/users/new');
  await expect(page.getByRole('heading', { level: 2, name: 'Novo usuário' })).toBeVisible();
});

test('trocar para um resultado muda o contexto financeiro', { tag: '@KAN-18-CA6' }, async ({ page, baseURL }) => {
  const user = await createTestUser();
  const prefix = uniqueName('Troca');
  const first = await createTestIndividual(user, `${prefix} Primeira`);
  const second = await createTestIndividual(user, `${prefix} Segunda`);
  await page
    .context()
    .addCookies([{ name: 'financial_context', value: `entity:${first.id}`, url: baseURL ?? '', httpOnly: true }]);
  await startAt(page, baseURL, user);
  const selector = page.getByRole('button', { name: /^Contexto: / });
  await expect(selector).toContainText(first.name);

  await searchField(page).click();
  await paletteInput(page).fill(second.name);
  await palette(page)
    .getByRole('group', { name: 'Contextos' })
    .getByRole('option', { name: `Trocar para ${second.name}` })
    .click();

  await expect(palette(page)).toBeHidden();
  await expect(selector).toContainText(second.name);
});

test('sem resultado, a paleta diz o que a pesquisa procura', { tag: '@KAN-18-CA7' }, async ({ page, baseURL }) => {
  await startAt(page, baseURL);
  const term = `zq${crypto.randomUUID().slice(0, 8)}`;

  await searchField(page).click();
  await paletteInput(page).fill(term);

  await expect(palette(page).getByText(`Nada encontrado para “${term}”`)).toBeVisible();
  await expect(
    palette(page).getByText('A pesquisa procura entidades, grupos financeiros, usuários e telas.'),
  ).toBeVisible();
  await expect(palette(page).getByRole('option')).toHaveCount(0);
});
