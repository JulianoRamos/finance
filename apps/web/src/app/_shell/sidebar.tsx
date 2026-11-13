import Link from 'next/link';

import { FOCUS_RING } from '../_access/access-screen';
import { AccountMenu } from './account-menu';
import { Hint } from './hint';
import { NavLink } from './nav-link';
import { NAVIGATION } from './pages';

/**
 * A barra lateral (design-system.md, seção 4.1): o logo, a navegação e o botão da conta. Aberta, tem
 * 280px no desktop; recolhida, ou abaixo de 1024px, só os ícones, com o nome de cada destino na dica.
 */
export function Sidebar({ user, expanded }: Readonly<{ user: { name: string; email: string }; expanded: boolean }>) {
  return (
    <nav
      id="sidebar"
      aria-label="Principal"
      className={`sticky top-0 z-20 flex h-screen flex-none flex-col items-center gap-1 border-r border-hairline bg-surface p-3 ${
        expanded ? 'w-16 lg:w-sidebar lg:items-stretch' : 'w-16'
      }`}
    >
      <Hint label="Início" expanded={expanded}>
        <Link
          href="/"
          className={`mb-1 flex items-center gap-2 rounded-sm text-ink ${expanded ? 'size-10 justify-center lg:h-12 lg:w-full lg:justify-start lg:px-2' : 'size-10 justify-center'} ${FOCUS_RING}`}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-8 flex-none items-center justify-center rounded-sm bg-primary text-heading-sm text-on-primary"
          >
            F
          </span>
          <span className={expanded ? 'sr-only text-heading-sm lg:not-sr-only' : 'sr-only'}>Finance</span>
          <span className="sr-only">, ir para o início</span>
        </Link>
      </Hint>
      {NAVIGATION.map(({ group, items }) => (
        <div key={group} className="flex flex-col items-center gap-1 lg:items-stretch">
          <span
            className={`px-2 pt-2 pb-1 font-mono text-eyebrow text-mute uppercase ${expanded ? 'hidden lg:block' : 'hidden'}`}
          >
            {group}
          </span>
          {items.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              expanded={expanded}
              icon={<Icon size={20} strokeWidth={1.5} aria-hidden="true" className="flex-none" />}
            />
          ))}
        </div>
      ))}
      <AccountMenu name={user.name} email={user.email} expanded={expanded} />
    </nav>
  );
}
