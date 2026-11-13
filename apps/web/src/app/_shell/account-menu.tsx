'use client';

import { ChevronsUpDown, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import { useTransition } from 'react';

import { FOCUS_RING } from '../_access/access-screen';
import { logoutAction } from './actions';
import { Avatar, UserLines } from './avatar';
import { Hint } from './hint';
import { MENU_ITEM, MENU_PANEL, MENU_SEPARATOR } from './menu';

/**
 * O botão da conta, no rodapé da barra lateral, e o menu dele: o nome e o e-mail, Minha conta e Sair
 * (design-system.md, seção 4.1).
 */
export function AccountMenu({ name, email, expanded }: Readonly<{ name: string; email: string; expanded: boolean }>) {
  const [, startTransition] = useTransition();
  const shape = expanded
    ? 'size-10 justify-center rounded-full lg:h-12 lg:w-full lg:justify-start lg:rounded-sm lg:px-2'
    : 'size-10 justify-center rounded-full';
  return (
    <DropdownMenu.Root modal={false}>
      <Hint label={name} expanded={expanded}>
        <DropdownMenu.Trigger
          className={`group mt-auto flex flex-none cursor-pointer items-center gap-2 hover:bg-surface-subtle aria-expanded:bg-accent-soft ${shape} ${FOCUS_RING}`}
        >
          <Avatar name={name} />
          <span className={expanded ? 'sr-only lg:not-sr-only lg:flex lg:min-w-0 lg:flex-1' : 'sr-only'}>
            {/* Sobre o `accent-soft` do botão aberto, o `mute` não alcança 4,5:1. */}
            <UserLines name={name} email={email} emailTone="text-mute group-aria-expanded:text-body" />
          </span>
          {expanded && (
            <ChevronsUpDown
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="ml-auto hidden text-body lg:block"
            />
          )}
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="right" align="end" sideOffset={8} className={MENU_PANEL}>
          <DropdownMenu.Label className="flex min-w-0 items-center gap-2 p-2">
            <Avatar name={name} />
            <UserLines name={name} email={email} />
          </DropdownMenu.Label>
          <DropdownMenu.Separator className={MENU_SEPARATOR} />
          <DropdownMenu.Item asChild className={MENU_ITEM}>
            <Link href="/profile">
              <User size={16} strokeWidth={1.5} aria-hidden="true" />
              Minha conta
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={MENU_SEPARATOR} />
          <DropdownMenu.Item
            className={MENU_ITEM}
            onSelect={() => {
              startTransition(() => logoutAction());
            }}
          >
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
