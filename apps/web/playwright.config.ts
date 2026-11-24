import { defineConfig, devices } from '@playwright/test';

// Os testes de ponta a ponta rodam no contêiner da web, contra a web no ar nele mesmo, em 127.0.0.1
// (a exceção de rede do AGENTS.md da raiz). A web chama a api pela rede interna, como em produção.
/**
 * Os arquivos dos testes que leem ou mudam o estado que vale para todo usuário do banco de desenvolvimento:
 * a Visão Familiar, que é única, e o contexto financeiro de partida, o primeiro do seletor, que pode ser
 * um grupo vazio de outro teste, porque todo usuário vê o grupo sem membros (regra 6.2).
 */
const SHARED_STATE = ['**/financial-groups.spec.ts', '**/financial-context.spec.ts'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // O relatório JSON é o que o conferidor do aceite lê.
  reporter: [['list'], ['json', { outputFile: 'reports/playwright.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: SHARED_STATE },
    // Os testes do estado que todo usuário vê rodam depois dos outros, um de cada vez: em paralelo, com a
    // máquina carregada, eles estouravam o prazo ou viam o que outro teste acabara de mudar.
    {
      name: 'shared-state',
      use: { ...devices['Desktop Chrome'] },
      testMatch: SHARED_STATE,
      dependencies: ['chromium'],
      workers: 1,
    },
  ],
});
