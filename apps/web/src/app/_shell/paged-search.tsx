'use client';

import { useState } from 'react';

import { inputClass } from '../_access/fields';
import { GHOST_BUTTON } from './buttons';

// A busca e o "Carregar mais" das listas que vêm inteiras da api (design-system.md, seções 4.1 e 4.3):
// a busca filtra na própria tela, a lista mostra 10 itens por vez, e o item que precisa continuar à
// vista (o aberto, ou o marcado) entra no fim, mesmo depois dos 10 primeiros.

/** Quantos itens a lista mostra de cada vez. */
const PAGE_SIZE = 10;

/** O texto sem acentos e em minúsculas, para "clinica" achar "Clínica". */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** O filtro pelo nome, sem acentos nem maiúsculas. A busca vazia acha todos. */
export function nameFilter(query: string): (item: { readonly name: string }) => boolean {
  const name = folded(query.trim());
  if (name === '') return () => true;
  return (item) => folded(item.name).includes(name);
}

/**
 * A busca e a página da lista: o texto buscado, os itens achados, os que aparecem (a página e, depois
 * dela, os que continuam à vista) e se há mais para carregar.
 */
export function usePagedSearch<Item>(
  items: readonly Item[],
  filterFor: (query: string) => (item: Item) => boolean,
  keepVisible: (item: Item) => boolean,
) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const found = items.filter(filterFor(query));
  const shown = [...found.slice(0, limit), ...found.slice(limit).filter(keepVisible)];
  return {
    query,
    search: (text: string) => {
      setQuery(text);
      setLimit(PAGE_SIZE);
    },
    found,
    shown,
    hasMore: shown.length < found.length,
    loadMore: () => {
      setLimit((current) => current + PAGE_SIZE);
    },
  };
}

/**
 * O campo da busca, com o rótulo só para o leitor de tela. Dentro de um formulário, o Enter busca e não
 * envia o formulário.
 */
export function SearchBox({
  id,
  label,
  query,
  onSearch,
}: Readonly<{ id: string; label: string; query: string; onSearch: (text: string) => void }>) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => {
          onSearch(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
        placeholder={label}
        autoComplete="off"
        className={inputClass('app')}
      />
    </>
  );
}

/** O botão que mostra os próximos 10 itens. */
export function LoadMoreButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick} className={GHOST_BUTTON}>
      Carregar mais
    </button>
  );
}
