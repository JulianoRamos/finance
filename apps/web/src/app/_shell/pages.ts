import { Building2, House, type LucideIcon, Users } from 'lucide-react';

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
export const SETTINGS: readonly Destination[] = [
  { href: '/entities', label: 'Entidades', icon: Building2 },
  { href: '/financial-groups', label: 'Grupos financeiros', icon: Users },
];

/** O nome de cada página, que o caminho da barra superior mostra. */
const PAGE_TITLES: readonly { readonly href: string; readonly label: string }[] = [
  ...NAVIGATION.flatMap(({ items }) => items),
  ...SETTINGS,
  { href: '/profile', label: 'Minha conta' },
];

/** Se o caminho é o do destino ou uma subpágina dele, como `/entities/<id>/edit` de `/entities`. */
export function isWithin(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** O nome da página do caminho, achado pelo início dele, ou nulo num caminho sem nome. */
export function pageTitleOf(pathname: string): string | null {
  return PAGE_TITLES.find(({ href }) => isWithin(pathname, href))?.label ?? null;
}
