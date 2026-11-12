import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// A acessibilidade automática da validação visual (design-system.md, seção 9): nenhuma violação séria
// ou crítica das regras da WCAG 2.2 AA, nos dois temas (seção 7).

const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SEVERE_IMPACTS = new Set(['serious', 'critical']);

for (const theme of ['light', 'dark'] as const) {
  test(`a página inicial não tem violação séria de acessibilidade no tema ${theme === 'light' ? 'claro' : 'escuro'}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await expect(page.getByRole('status')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
    const severe = violations
      .filter((violation) => SEVERE_IMPACTS.has(violation.impact ?? ''))
      .map((violation) => `${violation.id}: ${violation.help} (${String(violation.nodes.length)} elemento(s))`);

    expect(severe).toEqual([]);
  });
}
