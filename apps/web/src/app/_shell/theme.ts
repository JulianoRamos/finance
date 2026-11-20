/** O cookie que guarda o tema escolhido, lido pelo layout raiz no servidor. */
export const THEME_COOKIE = 'theme';

/** As escolhas de tema: claro, escuro, ou seguir a preferência do sistema. */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** A escolha guardada no cookie: o sistema, quando não há cookie ou o valor é desconhecido. */
export function themeChoiceOf(cookieValue: string | undefined): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice === cookieValue) ?? 'system';
}

/** O `data-theme` do `<html>` para a escolha: nenhum no sistema, que o `color-scheme` da raiz segue. */
export function dataThemeOf(choice: ThemeChoice): 'light' | 'dark' | undefined {
  return choice === 'system' ? undefined : choice;
}
