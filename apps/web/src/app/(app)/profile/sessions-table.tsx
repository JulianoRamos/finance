import type { SessionPage, SessionSummary } from '@/api/sessions';

import { deviceText, formatInstant } from '../../_shell/format';
import { mapPage } from '../../_shell/list-page';
import { SessionActions } from './session-actions';
import { SessionsPagination } from './sessions-pagination';

const HEAD = 'bg-surface-subtle px-3 py-2 text-left text-label text-mute whitespace-nowrap';
const CELL = 'h-10 border-t border-hairline px-3 whitespace-nowrap';

/** O que a tabela e a lista mostram de cada sessão. */
interface SessionView {
  readonly id: string;
  readonly current: boolean;
  readonly device: string;
  readonly origin: string;
  readonly lastUse: string;
}

function viewOf(session: SessionSummary): SessionView {
  return {
    id: session.id,
    current: session.current,
    device: deviceText(session.browser, session.platform),
    origin: session.origin,
    lastUse: session.current ? 'agora' : formatInstant(session.lastUsedAt),
  };
}

/** O selo da sessão do próprio pedido. */
function CurrentBadge({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <span
      className={`${className} rounded-full bg-positive-soft px-2 py-1 text-body-sm font-medium whitespace-nowrap text-positive`}
    >
      Esta sessão
    </span>
  );
}

/**
 * Uma página das sessões ativas do usuário, a atual marcada e as outras com o menu de ações: uma tabela
 * quando cabe e, numa área estreita, uma lista, com a Paginação no rodapé (design-system.md, seção 4.4).
 */
export function SessionsTable({ page, labelledBy }: Readonly<{ page: SessionPage; labelledBy: string }>) {
  const shown = mapPage(page, viewOf);
  return (
    // A tabela só aparece quando cabe: abaixo de `container-table`, como no celular ou na coluna ao lado da
    // troca de senha, as sessões vêm na lista (design-system.md, seção 4.4).
    <div className="@container flex flex-col overflow-hidden rounded-md border border-hairline">
      <ul aria-labelledby={labelledBy} className="flex flex-col @table:hidden">
        {shown.items.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between gap-3 border-t border-hairline p-3 first:border-t-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-ink">
                {session.device}
                {session.current && <CurrentBadge />}
              </span>
              <span className="text-body-sm text-mute">
                {session.origin} · {session.lastUse}
              </span>
            </div>
            {!session.current && <SessionActions id={session.id} device={session.device} size="list" />}
          </li>
        ))}
      </ul>
      <div className="relative hidden overflow-x-auto @table:block">
        <table aria-labelledby={labelledBy} className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={HEAD}>
                Aparelho
              </th>
              <th scope="col" className={HEAD}>
                Origem
              </th>
              <th scope="col" className={HEAD}>
                Último uso
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.items.map((session) => (
              <tr key={session.id} className="hover:bg-surface-subtle">
                <td className={`${CELL} text-ink`}>
                  {session.device}
                  {session.current && (
                    <>
                      {' '}
                      <CurrentBadge className="ml-2" />
                    </>
                  )}
                </td>
                <td className={CELL}>{session.origin}</td>
                <td className={CELL}>{session.lastUse}</td>
                <td className={`${CELL} text-right`}>
                  {session.current ? (
                    <span className="text-mute">
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">Sem ação</span>
                    </span>
                  ) : (
                    <SessionActions id={session.id} device={session.device} size="table" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-3">
        <SessionsPagination page={shown} />
      </div>
    </div>
  );
}
