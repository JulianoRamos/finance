'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';
import type { ListPage } from '../../_shell/list-page';
import { Pagination, useSearchedPages } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { searchUsersAction } from './actions';
import { useCreatedUser } from './created-user';
import type { UserListItem } from './user-list-page';

/** O selo do item: "Senha não definida" no tom de atenção, e "Desativado" neutro. */
function Badge({ item }: Readonly<{ item: UserListItem }>) {
  if (!item.badge) return null;
  const tone = item.active ? 'bg-warning-soft text-warning' : 'bg-surface-subtle text-body';
  return <span className={`flex-none rounded-full px-2 text-body-sm font-medium ${tone}`}>{item.badge}</span>;
}

/**
 * A Coluna da tela (design-system.md, seção 4.1): a busca no topo, os usuários de 10 em 10, com a
 * Paginação no rodapé, o aberto marcado quando está na página e, no cadastro, o item do novo no topo,
 * até ele ser criado. Cada busca e cada página é um pedido à api.
 */
export function UserList({ initial }: Readonly<{ initial: ListPage<UserListItem> }>) {
  // O segmento abaixo do layout da tela: `new` no cadastro, e o id do usuário no detalhe e na edição.
  const segment = useSelectedLayoutSegment();
  const created = useCreatedUser().id;
  const creating = segment === 'new' && created === null;
  const selectedId = segment === 'new' ? created : segment;
  const { query, shown, failed, search, goTo } = useSearchedPages(initial, searchUsersAction);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox id="user-search" label="Buscar usuário" query={query} onSearch={search} />
      {failed && <ErrorNotice>Não foi possível carregar os usuários. Tente de novo.</ErrorNotice>}
      {shown.total === 0 && <p className="px-3 py-2 text-body-sm text-mute">Nenhum usuário encontrado.</p>}
      <ul className="flex flex-col gap-1">
        {creating && <NewListItem label="Novo usuário" detail="Ainda não salvo" />}
        {shown.items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <Link
                href={`/users/${item.id}`}
                aria-current={selected ? 'page' : undefined}
                className={`${LIST_ITEM} ${selected ? LIST_ITEM_SELECTED : 'hover:bg-surface-subtle'} ${item.active ? 'text-ink' : 'text-mute'} ${FOCUS_RING}`}
              >
                <span className="flex items-start justify-between gap-2 font-medium">
                  <span className="min-w-0 wrap-anywhere">{item.name}</span>
                  <Badge item={item} />
                </span>
                {/* O mute não tem contraste sobre o accent-soft do item marcado. */}
                <span className={`text-body-sm wrap-anywhere ${selected ? 'text-body' : 'text-mute'}`}>
                  {item.detail}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Pagination page={shown.page} pageSize={shown.pageSize} total={shown.total} onPage={goTo} />
    </div>
  );
}
