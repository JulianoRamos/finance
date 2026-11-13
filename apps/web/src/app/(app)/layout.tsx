import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { currentSession } from '@/api/sessions';

import { AppShell } from '../_shell/app-shell';
import { isSidebarExpanded, SIDEBAR_COOKIE } from '../_shell/sidebar-state';

/**
 * A estrutura do app, em volta das páginas que exigem sessão. Sem uma sessão válida, vai para o login.
 * Quando a api não responde, mostra a página sem a estrutura, que precisa do nome e do e-mail do
 * usuário.
 */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const session = await currentSession();
  if (session.status === 'unauthenticated') redirect('/login');
  if (session.status === 'unavailable') return <main className="flex flex-col">{children}</main>;
  const sidebarExpanded = isSidebarExpanded((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <AppShell user={session.user} sidebarExpanded={sidebarExpanded}>
      {children}
    </AppShell>
  );
}
