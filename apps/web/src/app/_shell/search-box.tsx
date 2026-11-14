'use client';

import { inputClass } from '../_access/fields';

/**
 * O campo da busca de uma lista, com o rótulo só para o leitor de tela. Dentro de um formulário, o
 * Enter não envia o formulário.
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
