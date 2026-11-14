import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { createTestCompany, openTestCompany, openTestGroup } from './support/entities';
import { createPendingTestUser, createTestUser, openTestUser, signIn, uniqueOrigin } from './support/users';
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
      // Na largura padrão, a coluna das sessões, ao lado da troca de senha, mostra a lista.
      await expect(page.getByRole('list', { name: 'Sessões ativas' })).toBeVisible();
    },
  },
  {
    name: 'Minha conta em tela larga',
    open: async (page, baseURL) => {
      await page.setViewportSize({ width: 1600, height: 900 });
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
    name: 'o detalhe de uma entidade',
    open: async (page, baseURL) => {
      await openTestCompany(page, baseURL);
      await expect(page.getByRole('switch', { name: 'Clínica' })).toBeChecked();
    },
  },
  {
    name: 'a nova entidade',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.goto('/entities/new');
      await page.getByRole('radio', { name: /Pessoa jurídica/ }).check();
      await expect(page.getByRole('checkbox', { name: /Clínica/ })).toBeVisible();
    },
  },
  {
    name: 'a edição de uma entidade',
    open: async (page, baseURL) => {
      await openTestCompany(page, baseURL, '/edit');
      await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeVisible();
    },
  },
  {
    name: 'a confirmação de desligar a operação',
    open: async (page, baseURL) => {
      const entity = await openTestCompany(page, baseURL);
      await page.getByRole('switch', { name: 'Clínica' }).click();
      await expect(
        page.getByRole('alertdialog', { name: `Desligar a operação Clínica na ${entity.name}?` }),
      ).toBeVisible();
    },
  },
  {
    name: 'a confirmação de desativar a entidade',
    open: async (page, baseURL) => {
      const entity = await openTestCompany(page, baseURL);
      await page.getByRole('button', { name: 'Desativar entidade' }).click();
      await expect(page.getByRole('alertdialog', { name: `Desativar a ${entity.name}?` })).toBeVisible();
    },
  },
  {
    name: 'a Visão Familiar',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      // Garante uma empresa, que aparece bloqueada.
      await createTestCompany(user);
      await signIn(page.context(), user, baseURL);
      await page.goto('/financial-groups');
      await expect(page.getByRole('button', { name: 'Salvar membros' })).toBeVisible();
    },
  },
  {
    name: 'o novo grupo',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.goto('/financial-groups/new');
      await expect(page.getByRole('button', { name: 'Criar grupo' })).toBeVisible();
    },
  },
  {
    name: 'o formulário de um grupo',
    open: async (page, baseURL) => {
      await openTestGroup(page, baseURL);
      await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeVisible();
    },
  },
  {
    name: 'a confirmação de excluir o grupo',
    open: async (page, baseURL) => {
      const group = await openTestGroup(page, baseURL);
      await page.getByRole('button', { name: 'Excluir grupo' }).click();
      await expect(page.getByRole('alertdialog', { name: `Excluir o grupo ${group.name}?` })).toBeVisible();
    },
  },
  {
    name: 'o detalhe de um usuário, com o link de recuperação gerado',
    open: async (page, baseURL) => {
      await openTestUser(page, baseURL);
      await page.getByRole('button', { name: 'Gerar link de recuperação' }).click();
      await expect(page.getByRole('textbox', { name: 'Link de recuperação' })).toBeVisible();
    },
  },
  {
    name: 'o novo usuário',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser({ managesAccess: true }), baseURL);
      await page.goto('/users/new');
      await expect(page.getByRole('button', { name: 'Criar e gerar link' })).toBeVisible();
    },
  },
  {
    name: 'o usuário criado',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser({ managesAccess: true }), baseURL);
      await page.goto('/users/new');
      await page.getByLabel('Nome').fill('Bruno Teste');
      await page.getByLabel('E-mail').fill(`e2e-${crypto.randomUUID()}@exemplo.com`);
      await page.getByRole('button', { name: 'Criar e gerar link' }).click();
      await expect(page.getByRole('textbox', { name: 'Link para definir a senha' })).toBeVisible();
    },
  },
  {
    name: 'a edição de um usuário',
    open: async (page, baseURL) => {
      await openTestUser(page, baseURL, '/edit');
      await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeVisible();
    },
  },
  {
    name: 'a confirmação de desativar o usuário',
    open: async (page, baseURL) => {
      const user = await openTestUser(page, baseURL);
      await page.getByRole('button', { name: 'Desativar usuário' }).click();
      await expect(page.getByRole('alertdialog', { name: `Desativar ${user.name}?` })).toBeVisible();
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
