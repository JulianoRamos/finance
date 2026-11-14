'use client';

import type { AccessLevel } from '@/api/users';

import { ErrorNotice } from '../../_access/fields';
import type { ListPage } from '../../_shell/list-page';
import { Pagination, useSearchedPages } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { searchPermissionsAction } from './actions';
import type { PermissionRow } from './user-list-page';

/** As colunas dos níveis, na ordem da tabela, com o texto do rótulo de cada rádio. */
const LEVEL_COLUMNS: readonly { readonly level: AccessLevel; readonly label: string; readonly radio: string }[] = [
  { level: 'none', label: 'Sem acesso', radio: 'sem acesso' },
  { level: 'view', label: 'Ver', radio: 'ver' },
  { level: 'operate', label: 'Operar', radio: 'operar' },
];

/** A tabela com mais entidades que isto ganha a busca (design-system.md, seção 4.3). */
const SEARCH_ABOVE = 10;

const HEAD = 'bg-surface-subtle px-3 py-2 text-left text-label text-mute whitespace-nowrap';
const LEVEL_HEAD = `${HEAD} w-24 text-center`;
const CELL = 'h-10 border-t border-hairline px-3';

/**
 * A tabela de permissão por entidade (protótipo Usuarios): uma linha por entidade, com sem acesso, ver
 * e operar. As entidades vêm da api de 10 em 10, com a busca no topo e a Paginação no rodapé; a escolha
 * fica com quem usa a tabela, e sobrevive à busca e à troca de página.
 */
export function PermissionTable({
  userId,
  initial,
  idPrefix,
  levelOf,
  onChoose,
}: Readonly<{
  /** O usuário cujas entidades a tabela lista, com a busca e a ordem da lista das entidades. */
  userId: string;
  initial: ListPage<PermissionRow>;
  /** O prefixo dos nomes dos rádios, para dois formulários não dividirem um grupo. */
  idPrefix: string;
  /** O nível mostrado na linha: o escolhido, ou o lido. */
  levelOf: (row: PermissionRow) => AccessLevel;
  onChoose: (row: PermissionRow, level: AccessLevel) => void;
}>) {
  const { query, shown, failed, search, goTo } = useSearchedPages(initial, (page) =>
    searchPermissionsAction({ userId, ...page }),
  );
  const searchable = initial.total > SEARCH_ABOVE;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-label text-ink">Permissão por entidade</legend>
      {searchable && <SearchBox id={`${idPrefix}-search`} label="Buscar entidade" query={query} onSearch={search} />}
      {failed && <ErrorNotice>Não foi possível carregar as entidades. Tente de novo.</ErrorNotice>}
      {initial.total === 0 && <p className="text-body-sm text-mute">Nenhuma entidade cadastrada ainda.</p>}
      {initial.total > 0 && shown.total === 0 && <p className="text-body-sm text-mute">Nenhuma entidade encontrada.</p>}
      {shown.items.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th scope="col" className={HEAD}>
                  Entidade
                </th>
                {LEVEL_COLUMNS.map((column) => (
                  <th key={column.level} scope="col" className={LEVEL_HEAD}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.items.map((row) => {
                const level = levelOf(row);
                return (
                  <tr key={row.entityId}>
                    <th scope="row" className={`${CELL} text-left font-normal text-ink`}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="wrap-anywhere">{row.name}</span>
                        {!row.active && (
                          <span className="rounded-full bg-surface-subtle px-2 text-body-sm font-medium text-body">
                            Desativada
                          </span>
                        )}
                      </span>
                    </th>
                    {LEVEL_COLUMNS.map((column) => (
                      <td key={column.level} className={`${CELL} text-center`}>
                        <input
                          type="radio"
                          name={`${idPrefix}-${row.entityId}`}
                          aria-label={`${row.name}: ${column.radio}`}
                          checked={level === column.level}
                          onChange={() => {
                            onChoose(row, column.level);
                          }}
                          className="size-4 accent-accent"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {shown.total > shown.pageSize && (
        <Pagination page={shown.page} pageSize={shown.pageSize} total={shown.total} onPage={goTo} />
      )}
      <p className="text-body-sm text-mute">
        Sem acesso, a entidade some do seletor de contexto. Ver só lê; operar lê e altera.
      </p>
    </fieldset>
  );
}
