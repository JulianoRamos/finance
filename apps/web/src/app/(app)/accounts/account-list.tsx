'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';
import type { ListPage } from '../../_shell/list-page';
import { MoneyValue } from '../../_shell/money-value';
import { Pagination, useSearchedPages } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { searchAccountsAction } from './actions';
import type { AccountListItem } from './account-list-page';

/**
 * A Coluna da tela (design-system.md, seção 4.1): a busca no topo, as contas do contexto de 10 em 10, com a
 * Paginação no rodapé, a aberta marcada quando está na página e, na criação, o item da nova no topo.
 * Cada busca e cada página é um pedido à api.
 */
export function AccountList({ initial }: Readonly<{ initial: ListPage<AccountListItem> }>) {
  // O segmento abaixo do layout da tela: `new` na criação, e o id da conta no detalhe e na edição.
  const segment = useSelectedLayoutSegment();
  const creating = segment === 'new';
  const { query, shown, failed, search, goTo } = useSearchedPages(initial, searchAccountsAction);

  if (initial.total === 0) {
    // Sem nenhuma conta, não há o que buscar; na criação, a lista traz só o item da nova.
    return creating ? (
      <ul className="flex flex-col gap-1">
        <NewListItem label="Nova conta" detail="Ainda não salva" />
      </ul>
    ) : (
      <p className="px-3 py-2 text-body-sm text-mute">Nenhuma conta ainda.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBox id="account-search" label="Buscar conta" query={query} onSearch={search} />
      {failed && <ErrorNotice>Não foi possível carregar as contas. Tente de novo.</ErrorNotice>}
      {shown.total === 0 && <p className="px-3 py-2 text-body-sm text-mute">Nenhuma conta encontrada.</p>}
      <ul className="flex flex-col gap-1">
        {creating && <NewListItem label="Nova conta" detail="Ainda não salva" />}
        {shown.items.map((item) => {
          const selected = item.id === segment;
          return (
            <li key={item.id}>
              <Link
                href={`/accounts/${item.id}`}
                aria-current={selected ? 'page' : undefined}
                className={`${LIST_ITEM} ${selected ? LIST_ITEM_SELECTED : 'hover:bg-surface-subtle'} ${item.active ? 'text-ink' : 'text-mute'} ${FOCUS_RING}`}
              >
                <span className="flex items-start justify-between gap-2 font-medium">
                  <span className="min-w-0 wrap-anywhere">{item.name}</span>
                  {item.badge && (
                    <span
                      className={`flex-none rounded-full px-2 text-body-sm font-medium ${
                        item.active
                          ? `text-link ${selected ? 'bg-surface' : 'bg-accent-soft'}`
                          : 'bg-surface-subtle text-body'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
                {/* O mute não tem contraste sobre o accent-soft do item marcado. */}
                <span className="flex items-start justify-between gap-2 text-body-sm">
                  <span className={`min-w-0 wrap-anywhere ${selected ? 'text-body' : 'text-mute'}`}>{item.detail}</span>
                  <MoneyValue amount={item.balance} className="flex-none" />
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
