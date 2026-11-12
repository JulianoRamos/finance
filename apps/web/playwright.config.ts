import { defineConfig, devices } from '@playwright/test';

// Os testes de ponta a ponta rodam no contêiner da web, contra a web no ar nele mesmo, em 127.0.0.1
// (a exceção de rede do AGENTS.md da raiz). A web chama a api pela rede interna, como em produção.
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
