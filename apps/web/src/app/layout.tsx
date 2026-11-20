import './globals.css';

import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { dataThemeOf, THEME_COOKIE, themeChoiceOf } from './_shell/theme';

export const metadata: Metadata = {
  title: 'finance',
};

/**
 * O layout raiz lê o tema escolhido no servidor e o põe no `data-theme` do `<html>`, para a página já
 * chegar no tema certo, sem piscar (design-system.md, seção 2.1). Sem escolha, o `<html>` fica sem o
 * atributo, e o `color-scheme` da raiz segue a preferência do sistema.
 */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = themeChoiceOf((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-theme={dataThemeOf(theme)} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
