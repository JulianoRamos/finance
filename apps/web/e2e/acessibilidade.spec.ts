import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// A acessibilidade automática da validação visual (design-system.md, seção 9): nenhuma violação séria
// ou crítica das regras da WCAG 2.2 AA, nos dois temas (seção 7).

const REGRAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const GRAVES = new Set(['serious', 'critical']);

for (const tema of ['light', 'dark'] as const) {
  test(`a página inicial não tem violação séria de acessibilidade no tema ${tema === 'light' ? 'claro' : 'escuro'}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: tema });
    await page.goto('/');
    await expect(page.getByRole('status')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(REGRAS).analyze();
    const graves = violations
      .filter((violacao) => GRAVES.has(violacao.impact ?? ''))
      .map((violacao) => `${violacao.id}: ${violacao.help} (${String(violacao.nodes.length)} elemento(s))`);

    expect(graves).toEqual([]);
  });
}
