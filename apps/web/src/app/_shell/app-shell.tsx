import type { ReactNode } from 'react';

import { HintProvider } from './hint';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/**
 * A estrutura do app (design-system.md, seção 4.1): a barra lateral, a barra superior e, abaixo dela,
 * o conteúdo da página, que traz o cabeçalho e o corpo.
 */
export function AppShell({
  user,
  sidebarExpanded,
  children,
}: Readonly<{
  user: { name: string; email: string; managesAccess: boolean };
  sidebarExpanded: boolean;
  children: ReactNode;
}>) {
  return (
    <HintProvider>
      <div className="flex min-h-screen bg-surface-subtle">
        <Sidebar user={user} expanded={sidebarExpanded} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar sidebarExpanded={sidebarExpanded} managesAccess={user.managesAccess} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </HintProvider>
  );
}

/** O painel do Conteúdo das telas com a lista ao lado: o detalhe ou o formulário (design-system.md, seção 4.1). */
export const PANEL = 'flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6';

/** O cabeçalho da página: o título, a frase e, à direita, as ações da página, que rolam com o conteúdo. */
export function PageHeader({
  title,
  actions,
  children,
}: Readonly<{ title: string; actions?: ReactNode; children?: ReactNode }>) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-4 pt-8 lg:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading-lg text-ink">{title}</h1>
        {children && <p className="wrap-anywhere">{children}</p>}
      </div>
      {actions}
    </header>
  );
}

/** O corpo da página, com a margem lateral e o espaço entre os painéis. */
export function PageBody({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col gap-8 px-4 py-8 lg:px-10">{children}</div>;
}

/** Um cartão do corpo (design-system.md, seção 4.4). */
export function Card({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col gap-8 rounded-md border border-hairline bg-surface p-4 md:p-6">{children}</div>;
}
