import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { currentFinancialContext } from '@/api/financial-context';
import { currentSession } from '@/api/sessions';

import { AppShell } from '../_shell/app-shell';
import { selectedContextOf } from '../_shell/context-text';
import { isSidebarExpanded, SIDEBAR_COOKIE } from '../_shell/sidebar-state';

/**
 * A estrutura do app, em volta das páginas que exigem sessão. Sem uma sessão válida, vai para o login.
 * Quando a api não responde, mostra a página sem a estrutura, que precisa do nome e do e-mail do
 * usuário.
 */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  // A api autentica o pedido do contexto por conta própria: os dois saem juntos.
  const [session, current, cookieStore] = await Promise.all([currentSession(), currentFinancialContext(), cookies()]);
  if (session.status === 'unauthenticated') redirect('/login');
  if (session.status === 'unavailable') return <main className="flex flex-col">{children}</main>;
  const sidebarExpanded = isSidebarExpanded(cookieStore.get(SIDEBAR_COOKIE)?.value);
  const context = selectedContextOf(current);
  return (
    <AppShell user={session.user} context={context} sidebarExpanded={sidebarExpanded}>
      {children}
    </AppShell>
  );
}
