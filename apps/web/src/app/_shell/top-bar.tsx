'use client';

import { PanelLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';

import { FOCUS_RING } from '../_access/access-screen';
import { Hint } from './hint';
import { MENU_ITEM, MENU_PANEL } from './menu';
import { isWithin, pageTitleOf, SETTINGS } from './pages';
import { SIDEBAR_COOKIE } from './sidebar-state';

const ICON_BUTTON = `size-9 flex-none cursor-pointer items-center justify-center rounded-sm text-body hover:bg-surface-subtle ${FOCUS_RING}`;

/** Um ano, em segundos: o cookie da barra lateral é uma preferência, e não uma sessão. */
const ONE_YEAR_S = 365 * 24 * 60 * 60;

/** O botão que abre e recolhe a barra lateral. Abaixo de 1024px ela fica sempre recolhida, e ele some. */
function SidebarToggle({ expanded }: Readonly<{ expanded: boolean }>) {
  const router = useRouter();
  const label = expanded ? 'Recolher a barra lateral' : 'Abrir a barra lateral';
  return (
    <Hint label={label} expanded={false} side="bottom">
      <button
        type="button"
        aria-label={label}
        aria-controls="sidebar"
        aria-expanded={expanded}
        onClick={() => {
          // O layout lê o cookie no servidor, para a página não piscar ao carregar.
          document.cookie = `${SIDEBAR_COOKIE}=${expanded ? 'collapsed' : 'expanded'}; path=/; max-age=${String(ONE_YEAR_S)}; samesite=lax`;
          router.refresh();
        }}
        className={`hidden lg:inline-flex ${ICON_BUTTON}`}
      >
        <PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Hint>
  );
}

/** O caminho da página atual. */
function Breadcrumb() {
  const title = pageTitleOf(usePathname());
  if (!title) return null;
  return (
    <nav aria-label="Caminho">
      <ol className="flex items-center gap-2">
        <li>
          <span aria-current="page" className="font-medium text-ink">
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}

/**
 * A engrenagem e o menu das configurações, só quando há um cadastro para mostrar. Numa tela de
 * configuração, a engrenagem e o item dela ficam marcados.
 */
function SettingsMenu() {
  const pathname = usePathname();
  if (SETTINGS.length === 0) return null;
  const inSettings = SETTINGS.some(({ href }) => isWithin(pathname, href));
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Configurações"
        className={`inline-flex ${ICON_BUTTON} aria-expanded:bg-accent-soft ${inSettings ? 'bg-accent-soft' : ''}`}
      >
        <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="bottom" align="end" sideOffset={8} className={MENU_PANEL}>
          <DropdownMenu.Label className="px-2 pt-2 pb-1 font-mono text-eyebrow text-mute uppercase">
            Configurações
          </DropdownMenu.Label>
          {SETTINGS.map(({ href, label, icon: Icon }) => (
            <DropdownMenu.Item key={href} asChild className={`${MENU_ITEM} aria-[current=page]:bg-accent-soft`}>
              <Link href={href} aria-current={isWithin(pathname, href) ? 'page' : undefined}>
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * A barra superior (design-system.md, seção 4.1), fixa no topo: o botão da barra lateral, o caminho e,
 * à direita, as configurações.
 */
export function TopBar({ sidebarExpanded }: Readonly<{ sidebarExpanded: boolean }>) {
  return (
    <div className="sticky top-0 z-10 flex h-14 flex-none items-center gap-3 border-b border-hairline bg-surface pr-4 pl-3">
      <SidebarToggle expanded={sidebarExpanded} />
      <span aria-hidden="true" className="hidden h-4 w-px bg-hairline lg:block" />
      <Breadcrumb />
      <div className="ml-auto flex items-center gap-1">
        <SettingsMenu />
      </div>
    </div>
  );
}
