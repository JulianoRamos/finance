import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import {
  createTestCompany,
  createTestEquityStake,
  createTestGroup,
  createTestIndividual,
  grantFamilyViewAccess,
  openTestCompany,
  openTestGroup,
} from './support/entities';
import { openTestAccount, TEST_MOVEMENTS } from './support/accounts';
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

/**
 * Abre o diálogo do ajuste do saldo da conta de teste, com o saldo do banco digitado, e o registra sem o
 * motivo, para a tela mostrar o resumo e o motivo no estado de erro.
 */
async function openRefusedAdjustment(page: Page, baseURL: string) {
  const account = await openTestAccount(page, baseURL, undefined, { movements: TEST_MOVEMENTS });
  await page.getByRole('button', { name: 'Ajustar saldo' }).click();
  const dialog = page.getByRole('dialog', { name: `Ajustar o saldo de ${account.name}` });
  await dialog.getByLabel('Saldo no banco (R$)').fill('1.000,00');
  await dialog.getByRole('button', { name: 'Registrar ajuste' }).click();
  await expect(dialog.getByLabel('Motivo')).toHaveAccessibleDescription('Diga por que o saldo difere do banco.');
}

const SCREENS: readonly Screen[] = [
  {
    name: 'a página inicial',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      // Uma empresa dá ao usuário um contexto, que o Início mostra no cartão.
      await createTestCompany(user);
      await signIn(page.context(), user, baseURL);
      await page.goto('/');
      await expect(page.getByRole('status')).toBeVisible();
      await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toBeVisible();
    },
  },
  {
    name: 'o seletor de contexto aberto',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      await createTestCompany(user);
      await signIn(page.context(), user, baseURL);
      await page.goto('/');
      await page.getByRole('button', { name: /^Contexto: / }).click();
      await expect(page.getByRole('dialog', { name: 'Contexto financeiro' }).getByRole('group').first()).toBeVisible();
    },
  },
  {
    name: 'a paleta de pesquisa com as sugestões',
    open: async (page, baseURL) => {
      await signIn(page.context(), await createTestUser(), baseURL);
      await page.goto('/');
      await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Pesquisar' }).getByRole('group', { name: 'Ações' })).toBeVisible();
    },
  },
  {
    name: 'a paleta de pesquisa com resultados',
    open: async (page, baseURL) => {
      // O nome do usuário de teste termina num sufixo próprio, que acha também a entidade e o grupo dele.
      const user = await createTestUser({ managesAccess: true });
      const person = await createTestIndividual(user, `${user.name} Pessoa`);
      await createTestGroup(user, [person], `${user.name} Grupo`);
      await signIn(page.context(), user, baseURL);
      await page.goto('/');
      await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
      const palette = page.getByRole('dialog', { name: 'Pesquisar' });
      await palette.getByRole('combobox', { name: 'Pesquisar' }).fill(user.name.split(' ').at(-1) ?? '');
      await expect(palette.getByRole('group', { name: 'Usuários' })).toBeVisible();
      await expect(palette.getByRole('group', { name: 'Contextos' })).toBeVisible();
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
    name: 'o detalhe de uma empresa com uma participação e o registro aberto',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      const company = await createTestCompany(user);
      const person = await createTestIndividual(user);
      await createTestEquityStake(user, company, person, { fraction: '0.6', startDate: '2022-03-01' });
      await signIn(page.context(), user, baseURL);
      await page.goto(`/entities/${company.id}`);
      const section = page.getByRole('region', { name: 'Participações societárias' });
      await expect(
        section
          .getByRole('row', { name: new RegExp(person.name) })
          .or(section.getByRole('listitem').filter({ hasText: person.name })),
      ).toContainText('60,0%');
      await section.getByRole('button', { name: 'Registrar participação' }).click();
      await expect(section.getByRole('form', { name: 'Registrar participação' })).toBeVisible();
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
    name: 'o histórico de alterações da entidade',
    open: async (page, baseURL) => {
      await openTestCompany(page, baseURL);
      await page.getByRole('button', { name: 'Histórico' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Histórico de alterações' }).getByRole('listitem').first(),
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
    name: 'a lista das contas com o detalhe de uma conta',
    open: async (page, baseURL) => {
      const account = await openTestAccount(page, baseURL);
      await expect(page.getByRole('region', { name: account.name })).toContainText('R$ 1.234.567,89');
      await expect(
        page.getByRole('region', { name: 'Lista de contas' }).getByRole('link', { name: new RegExp(account.name) }),
      ).toBeVisible();
    },
  },
  {
    name: 'a nova conta',
    open: async (page, baseURL) => {
      await openTestAccount(page, baseURL, '/accounts/new');
      await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
    },
  },
  {
    name: 'a confirmação de desativar a conta',
    open: async (page, baseURL) => {
      const account = await openTestAccount(page, baseURL);
      await page.getByRole('button', { name: 'Desativar conta' }).click();
      await expect(page.getByRole('alertdialog', { name: `Desativar a conta ${account.name}?` })).toBeVisible();
    },
  },
  {
    name: 'o detalhe da conta com movimentações',
    open: async (page, baseURL) => {
      // Larga o bastante para o detalhe passar de `container-table` e mostrar a tabela, e não a lista estreita.
      await page.setViewportSize({ width: 1600, height: 900 });
      const account = await openTestAccount(page, baseURL, undefined, { movements: TEST_MOVEMENTS });
      await expect(page.getByRole('region', { name: account.name }).getByRole('table')).toContainText('Salário');
    },
  },
  {
    name: 'a nova movimentação',
    open: async (page, baseURL) => {
      const account = await openTestAccount(page, baseURL, undefined, { movements: TEST_MOVEMENTS });
      await page.getByRole('button', { name: 'Nova movimentação' }).click();
      await expect(page.getByRole('dialog', { name: `Nova movimentação em ${account.name}` })).toBeVisible();
    },
  },
  {
    name: 'o detalhe da conta com movimentações no celular',
    open: async (page, baseURL) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const account = await openTestAccount(page, baseURL, undefined, { movements: TEST_MOVEMENTS });
      await expect(
        page.getByRole('list', { name: `Movimentações da conta ${account.name}` }).getByRole('listitem'),
      ).toHaveCount(2);
    },
  },
  {
    name: 'a nova movimentação no celular',
    open: async (page, baseURL) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const account = await openTestAccount(page, baseURL, undefined, { movements: TEST_MOVEMENTS });
      await page.getByRole('button', { name: 'Nova movimentação' }).click();
      await expect(page.getByRole('dialog', { name: `Nova movimentação em ${account.name}` })).toBeVisible();
    },
  },
  {
    name: 'o ajuste do saldo, com o motivo recusado',
    open: openRefusedAdjustment,
  },
  {
    name: 'o ajuste do saldo no celular, com o motivo recusado',
    open: async (page, baseURL) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openRefusedAdjustment(page, baseURL);
    },
  },
  {
    name: 'a lista das contas no celular',
    open: async (page, baseURL) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const account = await openTestAccount(page, baseURL, '/accounts');
      await expect(
        page.getByRole('region', { name: 'Lista de contas' }).getByRole('link', { name: new RegExp(account.name) }),
      ).toBeVisible();
    },
  },
  {
    name: 'a Visão Familiar',
    open: async (page, baseURL) => {
      const user = await createTestUser();
      // Garante uma empresa, que aparece bloqueada.
      await createTestCompany(user);
      await grantFamilyViewAccess(user);
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

/**
 * Os temas conferidos: o claro e o escuro do sistema, sem escolha, e o escuro escolhido pelo usuário no
 * cookie com o sistema no claro (KAN-17-CA4), que prova também que a escolha vence o sistema.
 */
const THEMES = [
  { label: 'claro', details: {}, system: 'light' },
  { label: 'escuro do sistema', details: {}, system: 'dark' },
  { label: 'escuro', details: { tag: '@KAN-17-CA4' }, system: 'light', chosen: 'dark' },
] as const;

for (const screen of SCREENS) {
  for (const theme of THEMES) {
    test(
      `${screen.name} não tem violação séria de acessibilidade no tema ${theme.label}`,
      theme.details,
      async ({ page, baseURL }) => {
        await page.setExtraHTTPHeaders({ 'X-Forwarded-For': uniqueOrigin() });
        await page.emulateMedia({ colorScheme: theme.system });
        if ('chosen' in theme) {
          await page.context().addCookies([{ name: 'theme', value: theme.chosen, url: baseURL ?? '' }]);
        }
        await screen.open(page, baseURL ?? '');
        // Sem isso, um cookie ignorado faria a rodada do escuro analisar o tema claro e passar.
        if ('chosen' in theme) await expect(page.locator('html')).toHaveAttribute('data-theme', theme.chosen);

        const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
        const severe = violations
          .filter((violation) => SEVERE_IMPACTS.has(violation.impact ?? ''))
          .map((violation) => `${violation.id}: ${violation.help} (${String(violation.nodes.length)} elemento(s))`);

        expect(severe).toEqual([]);
      },
    );
  }
}
