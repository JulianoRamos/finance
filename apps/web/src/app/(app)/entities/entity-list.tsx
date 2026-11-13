'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useState } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { inputClass } from '../../_access/fields';
import { GHOST_BUTTON } from '../../_shell/buttons';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';
import { stripTaxId } from './tax-id-format';

/** Uma entidade como a lista a mostra, já formatada. */
export interface EntityListItem {
  readonly id: string;
  readonly name: string;
  /** O selo: o tipo (PF ou PJ), ou "Desativada". */
  readonly badge: string;
  /** A segunda linha: o documento, a operação ligada ou, na desativada, o tipo. */
  readonly detail: string;
  readonly active: boolean;
  /**
   * O CNPJ só com os caracteres, que a busca também confere, ou nulo. Nulo sempre na pessoa física: o
   * CPF aparece mascarado na lista, e o completo não vai ao navegador (design-system.md, seção 3).
   */
  readonly taxId: string | null;
}

/** Quantas entidades a lista mostra de cada vez (design-system.md, seção 4.4: "Carregar mais"). */
const PAGE_SIZE = 10;

/** O texto sem acentos e em minúsculas, para "clinica" achar "Clínica". */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * O filtro da busca: pelo nome, sem acentos nem maiúsculas, ou pelo documento escrito com ou sem a
 * pontuação. A busca vazia acha todas.
 */
function searchFilter(query: string): (item: EntityListItem) => boolean {
  const name = folded(query.trim());
  const document = stripTaxId(name);
  if (name === '') return () => true;
  return (item) =>
    folded(item.name).includes(name) || (document !== '' && (item.taxId?.toLowerCase().includes(document) ?? false));
}

/**
 * A Coluna da tela (design-system.md, seção 4.1): a busca no topo e as entidades, 10 por vez, com a
 * aberta marcada e, na criação, o item da nova no topo. A lista vem inteira da api, e a busca a filtra
 * na tela.
 */
export function EntityList({ items }: Readonly<{ items: readonly EntityListItem[] }>) {
  // O segmento abaixo do layout da tela: `new` na criação, e o id da entidade no detalhe e na edição.
  const segment = useSelectedLayoutSegment();
  const creating = segment === 'new';
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const found = items.filter(searchFilter(query));
  const page = found.slice(0, limit);
  // A entidade aberta continua à vista: depois da página, ela entra no fim, sozinha.
  const openItem = found.find((item) => item.id === segment);
  const shown = openItem && !page.includes(openItem) ? [...page, openItem] : page;

  if (items.length === 0) {
    // Sem nenhuma entidade, não há o que buscar; na criação, a lista traz só o item da nova.
    return creating ? (
      <ul className="flex flex-col gap-1">
        <NewListItem label="Nova entidade" detail="Ainda não salva" />
      </ul>
    ) : (
      <p className="px-3 py-2 text-body-sm text-mute">Nenhuma entidade ainda.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="entity-search" className="sr-only">
          Buscar entidade
        </label>
        <input
          id="entity-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Buscar entidade"
          autoComplete="off"
          className={inputClass('app')}
        />
      </div>
      {found.length === 0 && <p className="px-3 py-2 text-body-sm text-mute">Nenhuma entidade encontrada.</p>}
      <ul className="flex flex-col gap-1">
        {creating && <NewListItem label="Nova entidade" detail="Ainda não salva" />}
        {shown.map((item) => {
          const selected = item.id === segment;
          return (
            <li key={item.id}>
              <Link
                href={`/entities/${item.id}`}
                aria-current={selected ? 'page' : undefined}
                className={`${LIST_ITEM} ${selected ? LIST_ITEM_SELECTED : 'hover:bg-surface-subtle'} ${item.active ? 'text-ink' : 'text-mute'} ${FOCUS_RING}`}
              >
                <span className="flex items-start justify-between gap-2 font-medium">
                  <span className="min-w-0 wrap-anywhere">{item.name}</span>
                  <span
                    className={`flex-none rounded-full px-2 text-body-sm font-medium ${
                      item.active
                        ? `text-link ${selected ? 'bg-surface' : 'bg-accent-soft'}`
                        : 'bg-surface-subtle text-body'
                    }`}
                  >
                    {item.badge}
                  </span>
                </span>
                {/* O mute não tem contraste sobre o accent-soft do item marcado. */}
                <span className={`text-body-sm ${selected ? 'text-body' : 'text-mute'}`}>{item.detail}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {page.length < found.length && (
        <button
          type="button"
          onClick={() => {
            setLimit(page.length + PAGE_SIZE);
          }}
          className={GHOST_BUTTON}
        >
          Carregar mais
        </button>
      )}
    </div>
  );
}
