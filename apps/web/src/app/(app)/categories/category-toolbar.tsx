'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { SEARCH_DELAY_MS } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { categoryParams } from './category-params';
import { categoriesHref, type CategoryParams, type Nature, NATURE_TEXT, NATURES } from '../../_shell/category-text';

/** O id de cada aba, que o painel da árvore cita como o rótulo dele. */
export function tabId(nature: Nature): string {
  return `category-tab-${nature}`;
}

/**
 * O topo do cartão da árvore: as abas Despesas e Receitas, a busca e o "Mostrar desativadas", que mudam o
 * endereço, e o servidor lê a árvore de novo. A busca espera 300 ms depois da última tecla e volta à
 * primeira página.
 */
export function CategoryToolbar({ params }: Readonly<{ params: CategoryParams }>) {
  const router = useRouter();
  const [query, setQuery] = useState(params.q);
  // A busca que a tela pediu por último: o endereço que muda por fora, como pela paleta, troca o campo.
  const requested = useRef(params.q);
  useEffect(() => {
    if (params.q !== requested.current) {
      requested.current = params.q;
      setQuery(params.q);
    }
  }, [params.q]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  /**
   * Troca o endereço sobre o estado dado, de volta à primeira página. A busca, que espera, parte do endereço
   * de quando ela dispara, para não desfazer uma troca de aba feita nesse meio-tempo.
   */
  function go(next: Partial<CategoryParams>, from: CategoryParams = params) {
    router.replace(categoriesHref({ ...from, page: 1, ...next }), { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 max-md:py-2">
      <div role="tablist" aria-label="Natureza" className="flex gap-4">
        {NATURES.map((nature) => {
          const selected = nature === params.nature;
          return (
            <button
              key={nature}
              id={tabId(nature)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="category-tree"
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                if (!selected) go({ nature });
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                const other = nature === 'expense' ? 'revenue' : 'expense';
                document.getElementById(tabId(other))?.focus();
                go({ nature: other });
              }}
              className={`h-11 cursor-pointer text-label border-b-2 ${selected ? 'border-accent text-ink' : 'border-transparent text-body'} ${FOCUS_RING}`}
            >
              {NATURE_TEXT[nature].tab}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-search max-md:w-full">
          <SearchBox
            id="category-search"
            label="Buscar categoria"
            query={query}
            onSearch={(text) => {
              setQuery(text);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                requested.current = text;
                go({ q: text }, categoryParams(Object.fromEntries(new URLSearchParams(window.location.search))));
              }, SEARCH_DELAY_MS);
            }}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-body">
          <input
            type="checkbox"
            checked={params.showInactive}
            onChange={(event) => {
              go({ showInactive: event.target.checked });
            }}
            className={`size-4 accent-ink ${FOCUS_RING}`}
          />
          Mostrar desativadas
        </label>
      </div>
    </div>
  );
}
