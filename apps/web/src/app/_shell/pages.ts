import { House, type LucideIcon } from 'lucide-react';

/** Um destino da estrutura do app: o caminho, o nome e o ícone. */
export interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** A navegação da barra lateral, por grupo (design-system.md, seção 4.1). */
export const NAVIGATION: readonly { readonly group: string; readonly items: readonly Destination[] }[] = [
  { group: 'Geral', items: [{ href: '/', label: 'Início', icon: House }] },
];

/**
 * Os cadastros do menu das configurações, que só aparecem quando a tela deles existe. Sem nenhum, a
 * engrenagem não aparece.
 */
export const SETTINGS: readonly Destination[] = [];

/** O nome de cada página, que o caminho da barra superior mostra. */
export const PAGE_TITLES: Readonly<Record<string, string>> = Object.fromEntries(
  [...NAVIGATION.flatMap(({ items }) => items), ...SETTINGS, { href: '/profile', label: 'Minha conta' }].map(
    ({ href, label }) => [href, label],
  ),
);
