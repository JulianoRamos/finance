'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';
import type { ListPage } from '../../_shell/list-page';
import { Pagination, useSearchedPages } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { searchFinancialGroupsAction } from './actions';
import type { GroupListItem } from './group-list-page';

/**
 * A Coluna da tela (design-system.md, seção 4.1): a busca no topo e os grupos de 10 em 10, a Visão
 * Familiar primeiro, com a Paginação no rodapé, o aberto marcado quando está na página e, na criação,
 * o item do novo no topo. Cada busca e cada página é um pedido à api.
 */
export function GroupList({ initial }: Readonly<{ initial: ListPage<GroupListItem> }>) {
  // O segmento abaixo do layout da tela: `new` na criação, e o id do grupo no formulário dele.
  const segment = useSelectedLayoutSegment();
  const { query, shown, failed, search, goTo } = useSearchedPages(initial, searchFinancialGroupsAction);

  return (
    <div className="flex flex-col gap-3">
      <SearchBox id="group-search" label="Buscar grupo" query={query} onSearch={search} />
      {failed && <ErrorNotice>Não foi possível carregar os grupos. Tente de novo.</ErrorNotice>}
      {shown.total === 0 && <p className="px-3 py-2 text-body-sm text-mute">Nenhum grupo encontrado.</p>}
      <ul className="flex flex-col gap-1">
        {segment === 'new' && <NewListItem label="Novo grupo" detail="Ainda não salvo" />}
        {shown.items.map((item) => {
          const selected = item.id === segment;
          return (
            <li key={item.id}>
              <Link
                href={`/financial-groups/${item.id}`}
                aria-current={selected ? 'page' : undefined}
                className={`${LIST_ITEM} text-ink ${selected ? LIST_ITEM_SELECTED : 'hover:bg-surface-subtle'} ${FOCUS_RING}`}
              >
                <span className="font-medium wrap-anywhere">{item.name}</span>
                {/* O mute não tem contraste sobre o accent-soft do item marcado. */}
                <span className={`text-body-sm wrap-anywhere ${selected ? 'text-body' : 'text-mute'}`}>
                  {item.summary}
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
