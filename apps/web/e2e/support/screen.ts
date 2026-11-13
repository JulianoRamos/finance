import type { Locator, Page } from '@playwright/test';

/**
 * O aviso da tela (`role="alert"`), procurado dentro do `main`: depois da hidratação, o Next põe na
 * página o anunciador de rota, um segundo `alert`, fora dele.
 */
export function screenAlert(page: Page): Locator {
  return page.getByRole('main').getByRole('alert');
}
