import { Building2, House, ListTree, Lock, type LucideIcon, Plus, User, Users, Wallet } from 'lucide-react';

/** Um destino da estrutura do app: o caminho, o nome e o ícone. */
export interface Destination {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** A navegação da barra lateral, por grupo (design-system.md, seção 4.1). */
export const NAVIGATION: readonly { readonly group: string; readonly items: readonly Destination[] }[] = [
  { group: 'Geral', items: [{ href: '/', label: 'Início', icon: House }] },
  {
    group: 'Dinheiro',
    items: [
      { href: '/accounts', label: 'Contas', icon: Wallet },
      { href: '/categories', label: 'Categorias', icon: ListTree },
    ],
  },
];

/** Um cadastro do menu das configurações, que pode ser só de quem gere acessos (regra 6.1). */
export interface SettingsDestination extends Destination {
  readonly managesAccess?: boolean;
}

/**
 * Os cadastros do menu das configurações, que só aparecem quando a tela deles existe. Sem nenhum, a
 * engrenagem não aparece.
 */
export const SETTINGS: readonly SettingsDestination[] = [
  { href: '/entities', label: 'Entidades', icon: Building2 },
  { href: '/financial-groups', label: 'Grupos financeiros', icon: Users },
  { href: '/users', label: 'Usuários e acessos', icon: Lock, managesAccess: true },
];

/** Os cadastros do menu das configurações que o usuário vê: os de quem gere acessos, só para ele. */
export function settingsFor(managesAccess: boolean): readonly SettingsDestination[] {
  return SETTINGS.filter((destination) => managesAccess || !destination.managesAccess);
}

/** A página da conta, aberta pelo menu da conta. */
const ACCOUNT: Destination = { href: '/profile', label: 'Minha conta', icon: User };

/** O nome de cada página, que o caminho da barra superior mostra. */
const PAGE_TITLES: readonly { readonly href: string; readonly label: string }[] = [
  ...NAVIGATION.flatMap(({ items }) => items),
  ...SETTINGS,
  ACCOUNT,
];

/**
 * Um destino ou uma ação da paleta de pesquisa que abre uma página (design-system.md, seção 4.5), com a
 * seção do destino, quando ele tem uma ("Configurações").
 */
export interface PaletteEntry extends SettingsDestination {
  readonly section?: string;
}

/** As ações da paleta que abrem uma página, que só aparecem para quem pode fazê-las (regra 6.1). */
const ACTIONS: readonly PaletteEntry[] = [
  { label: 'Nova entidade', icon: Plus, href: '/entities/new' },
  { label: 'Novo grupo financeiro', icon: Plus, href: '/financial-groups/new' },
  { label: 'Novo usuário', icon: Plus, href: '/users/new', managesAccess: true },
];

/**
 * Os destinos (Ir para) e as ações da paleta que o usuário vê, na ordem dela: a navegação, os cadastros
 * das configurações e a conta; os de quem gere acessos, só para ele.
 */
export function paletteEntriesFor(managesAccess: boolean): {
  readonly destinations: readonly PaletteEntry[];
  readonly actions: readonly PaletteEntry[];
} {
  return {
    destinations: [
      ...NAVIGATION.flatMap(({ items }) => items),
      ...settingsFor(managesAccess).map((destination) => ({ ...destination, section: 'Configurações' })),
      ACCOUNT,
    ],
    actions: ACTIONS.filter((action) => managesAccess || !action.managesAccess),
  };
}

/** Se o caminho é o do destino ou uma subpágina dele, como `/entities/<id>/edit` de `/entities`. */
export function isWithin(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** O nome da página do caminho, achado pelo início dele, ou nulo num caminho sem nome. */
export function pageTitleOf(pathname: string): string | null {
  return PAGE_TITLES.find(({ href }) => isWithin(pathname, href))?.label ?? null;
}
