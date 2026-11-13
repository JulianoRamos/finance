'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';

import { FOCUS_RING } from '../../_access/access-screen';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';

/** Um grupo como a lista o mostra, com a segunda linha já escrita. */
export interface GroupListItem {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
}

/**
 * A Coluna da tela (design-system.md, seção 4.1): os grupos, a Visão Familiar primeiro, com o aberto
 * marcado e, na criação, o item do novo no topo. Os grupos são poucos: a lista vem inteira, sem busca.
 */
export function GroupList({ items }: Readonly<{ items: readonly GroupListItem[] }>) {
  // O segmento abaixo do layout da tela: `new` na criação, e o id do grupo no formulário dele.
  const segment = useSelectedLayoutSegment();

  return (
    <ul className="flex flex-col gap-1">
      {segment === 'new' && <NewListItem label="Novo grupo" detail="Ainda não salvo" />}
      {items.map((item) => {
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
  );
}
