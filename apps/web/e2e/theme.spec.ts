import { expect, type Page, type Response, test } from '@playwright/test';

import { createTestUser, signIn } from './support/users';

/**
 * A luminância relativa da cor de fundo do `body`, de 0 a 1, lida no navegador. A cor passa por um
 * canvas, que a converte para RGB qualquer que seja a forma dela no CSS (`oklch`, `light-dark()`).
 */
function backgroundLuminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não deu o contexto 2D do canvas.');
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    const linear = (channel: number) => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  });
}

/** Confere que a página está escura (luminância do fundo abaixo da metade) ou clara (acima). */
async function expectPageTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await expect
    .poll(async () => ((await backgroundLuminance(page)) < 0.5 ? 'dark' : 'light'), {
      message: `a página deveria estar ${theme === 'dark' ? 'escura' : 'clara'}`,
    })
    .toBe(theme);
}

test(
  'sem escolha, a página segue a preferência do sistema',
  { tag: '@KAN-17-CA1' },
  async ({ page, context, baseURL }) => {
    await signIn(context, await createTestUser(), baseURL ?? '');

    for (const colorScheme of ['dark', 'light'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectPageTheme(page, colorScheme);
      await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    }
  },
);

test(
  'o usuário escolhe o tema pelo botão da barra superior, e a página muda na hora',
  { tag: '@KAN-17-CA2' },
  async ({ page, context, baseURL }) => {
    await signIn(context, await createTestUser(), baseURL ?? '');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expectPageTheme(page, 'light');

    // Uma marca na janela some se a página recarregar: a troca tem de ser na hora, sem ir ao servidor.
    await page.evaluate(() => {
      (window as unknown as { themeMark: boolean }).themeMark = true;
    });

    const themeButton = page.getByRole('button', { name: 'Tema' });
    const option = (name: string) => page.getByRole('menuitemradio', { name });

    await themeButton.click();
    await expect(option('Claro')).not.toBeChecked();
    await expect(option('Escuro')).not.toBeChecked();
    await expect(option('Sistema')).toBeChecked();

    await option('Escuro').click();
    await expectPageTheme(page, 'dark');
    await themeButton.click();
    await expect(option('Escuro')).toBeChecked();
    await expect(option('Sistema')).not.toBeChecked();

    await option('Claro').click();
    await expectPageTheme(page, 'light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await themeButton.click();
    await expect(option('Claro')).toBeChecked();
    await option('Sistema').click();
    await expectPageTheme(page, 'dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');

    expect(await page.evaluate(() => (window as unknown as { themeMark?: boolean }).themeMark)).toBe(true);
  },
);

/** O `<html>` de abertura do HTML que o servidor devolveu na navegação, antes de qualquer script rodar. */
async function htmlTagOf(response: Response | null): Promise<string> {
  return /<html[^>]*>/.exec((await response?.text()) ?? '')?.[0] ?? '';
}

test(
  'a escolha fica no cookie e a página já chega no tema escolhido',
  { tag: '@KAN-17-CA3' },
  async ({ page, context, baseURL }) => {
    const user = await createTestUser();
    await signIn(context, user, baseURL ?? '');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await page.getByRole('button', { name: 'Tema' }).click();
    await page.getByRole('menuitemradio', { name: 'Escuro' }).click();
    await expectPageTheme(page, 'dark');

    const reloaded = await page.reload();
    const themeCookie = (await context.cookies()).find((cookie) => cookie.name === 'theme');
    expect(themeCookie?.value).toBe('dark');
    expect(await htmlTagOf(reloaded)).toContain('data-theme="dark"');
    await expectPageTheme(page, 'dark');

    // A tela de entrar, fora da estrutura do app, segue a mesma escolha.
    await page.getByRole('button', { name: user.name }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');
    const login = await page.goto('/login');
    expect(await htmlTagOf(login)).toContain('data-theme="dark"');
    await expectPageTheme(page, 'dark');
  },
);
