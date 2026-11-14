import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { listUsers } from '@/api/users';

import { ErrorNotice } from '../../_access/fields';
import { PageHeader } from '../../_shell/app-shell';
import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { mapPage } from '../../_shell/list-page';
import { CreatedUserProvider } from './created-user';
import { UserList } from './user-list';
import { userListItem } from './user-list-page';

export const metadata: Metadata = { title: 'Usuários e acessos · finance' };

/**
 * A tela Usuários e acessos, só de quem gere acessos (regra 6.1): o cabeçalho, a lista ao lado e, no
 * lugar do Conteúdo, o detalhe ou o formulário da subpágina (design-system.md, seção 4.1). Para quem não
 * gere acessos, a api recusa a lista, e a tela é a página não encontrada.
 */
export default async function UsersLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const list = await listUsers();
  if (list.status === 'unauthenticated') redirect('/login');
  if (list.status === 'not-found') notFound();

  return (
    <CreatedUserProvider>
      <PageHeader
        title="Usuários e acessos"
        actions={
          <Link href="/users/new" className={PRIMARY_BUTTON}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Novo usuário
          </Link>
        }
      >
        Quem entra no sistema e o que cada um vê e opera em cada entidade.
      </PageHeader>
      <div className="grid items-start gap-8 px-4 py-8 lg:grid-cols-3 lg:px-10">
        <section
          aria-label="Lista de usuários"
          className="flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4"
        >
          {list.status === 'ok' ? (
            <UserList initial={mapPage(list.data, userListItem)} />
          ) : (
            <ErrorNotice>Não foi possível carregar os usuários.</ErrorNotice>
          )}
        </section>
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">{children}</div>
      </div>
    </CreatedUserProvider>
  );
}
