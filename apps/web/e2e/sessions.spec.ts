import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';

import { createTestUser, openSessionByLogin, signIn, type TestUser } from './support/users';

// Larga o bastante para a coluna das sessões, ao lado da troca de senha, caber a tabela (container-table).
test.use({ viewport: { width: 1600, height: 900 } });

const FIREFOX_ON_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
const CHROME_ON_MACOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** Entra pela tela de login num contexto com o User-Agent e a origem dados, e devolve a página. */
async function loginFrom(
  browser: Browser,
  baseURL: string,
  user: TestUser,
  client: { userAgent: string; origin: string },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL,
    userAgent: client.userAgent,
    extraHTTPHeaders: { 'X-Forwarded-For': client.origin },
  });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
  return { context, page };
}

test('o usuário vê as próprias sessões, com a atual marcada', { tag: '@KAN-10-CA1' }, async ({ browser, baseURL }) => {
  const user = await createTestUser();
  // Outro usuário com sessão aberta, que não pode aparecer na lista.
  await createTestUser();
  const firefox = await loginFrom(browser, baseURL ?? '', user, {
    userAgent: FIREFOX_ON_WINDOWS,
    origin: '203.0.113.7',
  });
  const chromeLogin = await loginFrom(browser, baseURL ?? '', user, {
    userAgent: CHROME_ON_MACOS,
    origin: '192.0.2.10',
  });
  const { page } = chromeLogin;

  await page.getByRole('button', { name: user.name }).click();
  await page.getByRole('menuitem', { name: 'Minha conta' }).click();

  const table = page.getByRole('table', { name: 'Sessões ativas' });
  const rows = table.getByRole('row').filter({ has: page.getByRole('cell') });
  // As duas do login e a aberta pela preparação do usuário, e nenhuma de outro.
  await expect(rows).toHaveCount(3);

  const chrome = rows.filter({ hasText: 'Chrome no macOS' });
  await expect(chrome).toContainText('Esta sessão');
  await expect(chrome).toContainText('192.0.2.10');
  await expect(chrome.getByRole('cell').nth(2)).toHaveText('agora');
  await expect(chrome.getByRole('button', { name: /Ações da sessão/ })).toHaveCount(0);

  const other = rows.filter({ hasText: 'Firefox no Windows' });
  await expect(other).toContainText('203.0.113.7');
  await expect(other.getByRole('cell').nth(2)).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  await expect(other.getByRole('button', { name: 'Ações da sessão Firefox no Windows' })).toBeVisible();

  await firefox.context.close();
  await chromeLogin.context.close();
});

test(
  'a tabela das sessões pagina de 10 em 10 e encerra pelo menu da linha sem mudar de página',
  { tag: '@KAN-20-CA3' },
  async ({ page, context, baseURL }) => {
    const user = await createTestUser();
    // Um de cada vez: o limite de tentativas conta como falha o login em curso (regra 6.1).
    for (let login = 0; login < 13; login += 1) await openSessionByLogin(user);
    await signIn(context, user, baseURL ?? '');

    await page.goto('/profile');

    const table = page.getByRole('table', { name: 'Sessões ativas' });
    const rows = table.getByRole('row').filter({ has: page.getByRole('cell') });
    const pagination = page.getByRole('navigation', { name: 'Paginação' });
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toContainText('Esta sessão');
    await expect(rows.first().getByRole('button', { name: /Ações da sessão/ })).toHaveCount(0);
    await expect(pagination).toContainText('1–10 de 14');
    await expect(pagination.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await pagination.getByRole('button', { name: 'Próxima página' }).click();

    await expect(pagination).toContainText('11–14 de 14');
    await expect(rows).toHaveCount(4);
    await expect(pagination.getByRole('button', { name: 'Próxima página' })).toBeDisabled();

    await rows
      .first()
      .getByRole('button', { name: /Ações da sessão/ })
      .click();
    await page.getByRole('menuitem', { name: 'Encerrar sessão' }).click();

    await expect(pagination).toContainText('11–13 de 13');
    await expect(rows).toHaveCount(3);
    await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  },
);
