'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { FOCUS_RING } from '../_access/access-screen';
import { Hint } from './hint';

/** Um item da navegação da barra lateral, com o ícone dado, marcado quando é a página atual. */
export function NavLink({
  href,
  label,
  expanded,
  icon,
}: Readonly<{ href: string; label: string; expanded: boolean; icon: ReactNode }>) {
  const current = usePathname() === href;
  const shape = expanded
    ? 'size-10 justify-center lg:h-9 lg:w-full lg:justify-start lg:px-2'
    : 'size-10 justify-center';
  return (
    <Hint label={label} expanded={expanded}>
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        className={`flex items-center gap-2 rounded-sm text-body hover:bg-surface-subtle aria-[current=page]:bg-accent-soft aria-[current=page]:text-ink ${shape} ${FOCUS_RING}`}
      >
        {icon}
        <span className={expanded ? 'sr-only lg:not-sr-only' : 'sr-only'}>{label}</span>
      </Link>
    </Hint>
  );
}
