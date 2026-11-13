import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { createPendingTestUser, createTestUser, signIn, uniqueOrigin } from './support/users';
import { screenAlert } from './support/screen';

// A acessibilidade automática da validação visual (design-system.md, seção 9): nenhuma violação séria
// ou crítica das regras da WCAG 2.2 AA, nos dois temas (seção 7).

const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SEVERE_IMPACTS = new Set(['serious', 'critical']);

/** Uma tela: o nome no título do teste, como abri-la e o que conferir antes de analisar. */
interface Screen {
  readonly name: string;
  readonly open: (page: Page, baseURL: string) => Promise<void>;
}

const heading = (page: Page, name: string) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

const SCREENS: readonly Screen[] = [
  {
    name: 'a página inicial',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.goto('/');
      await expect(page.getByRole('status')).toBeVisible();
    },
  },
  {
    name: 'Minha conta',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.goto('/profile');
      await expect(page.getByRole('table', { name: 'Sessões ativas' })).toBeVisible();
    },
  },
  {
    name: 'o menu da conta aberto',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      await signIn(page.context(), user, baseURL);
      await page.goto('/');
      await page.getByRole('button', { name: user.name }).click();
      await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
    },
  },
  {
    name: 'a barra lateral recolhida',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.context().addCookies([{ name: 'sidebar', value: 'collapsed', url: baseURL }]);
      await page.goto('/profile');
      await expect(page.getByRole('button', { name: 'Abrir a barra lateral' })).toBeVisible();
    },
  },
  {
    name: 'o login',
    open: async (page) => {
      await page.goto('/login');
      await heading(page, 'Entrar no Finance');
    },
  },
  {
    name: 'o login com o aviso de erro',
    open: async (page) => {
      await page.goto('/login');
      // Um e-mail só desta execução, para as falhas de outras não o bloquearem e mostrarem outro aviso.
      await page.getByLabel('E-mail').fill(`ninguem-${crypto.randomUUID()}@exemplo.com`);
      await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(screenAlert(page)).toHaveText('E-mail ou senha incorretos. Confira os dois e tente de novo.');
    },
  },
  {
    name: 'a definição da senha',
    open: async (page) => {
      const user = await createPendingTestUser();
      await page.goto(`/set-password/${user.linkToken}`);
      await heading(page, 'Defina sua senha');
    },
  },
  {
    name: 'o link de recuperação vencido',
    open: async (page) => {
      await page.goto('/set-password/link-que-nao-existe');
      await heading(page, 'Este link não vale mais');
    },
  },
  {
    name: 'a recuperação do acesso',
    open: async (page) => {
      await page.goto('/recover-access');
      await heading(page, 'Recuperar o acesso');
    },
  },
];

for (const screen of SCREENS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${screen.name} não tem violação séria de acessibilidade no tema ${theme === 'light' ? 'claro' : 'escuro'}`, async ({
      page,
      baseURL,
    }) => {
      await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
      await page.emulateMedia({ colorScheme: theme });
      await screen.open(page, baseURL ?? '');

      const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
      const severe = violations
        .filter((violation) => SEVERE_IMPACTS.has(violation.impact ?? ''))
        .map((violation) => `${violation.id}: ${violation.help} (${String(violation.nodes.length)} elemento(s))`);

      expect(severe).toEqual([]);
    });
  }
}
