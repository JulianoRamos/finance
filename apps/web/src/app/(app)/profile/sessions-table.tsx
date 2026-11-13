import type { SessionSummary } from '@/api/sessions';

import { FOCUS_RING } from '../../_access/access-screen';
import { deviceText, formatInstant } from '../../_shell/format';
import { endSessionAction } from './actions';

const HEAD = 'bg-surface-subtle px-3 py-2 text-left text-label text-mute whitespace-nowrap';
const CELL = 'h-12 border-t border-hairline px-3 whitespace-nowrap';

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

/** O botão secundário de encerrar a sessão, com a altura dada. */
function EndSessionButton({ session, height }: Readonly<{ session: SessionView; height: string }>) {
  return (
    <form action={endSessionAction}>
      <input type="hidden" name="id" value={session.id} />
      <button
        type="submit"
        aria-label={`Encerrar a sessão ${session.device}`}
        className={`${height} cursor-pointer rounded-sm border border-hairline-strong bg-surface px-3 text-label text-ink hover:bg-surface-subtle ${FOCUS_RING}`}
      >
        Encerrar
      </button>
    </form>
  );
}

/**
 * As sessões ativas do usuário, a atual marcada e as outras com o botão de encerrar: uma tabela a
 * partir do tablet e, no celular, uma lista (design-system.md, seção 4.4).
 */
export function SessionsTable({ sessions, labelledBy }: Readonly<{ sessions: SessionSummary[]; labelledBy: string }>) {
  const views = sessions.map(viewOf);
  return (
    <>
      <ul aria-labelledby={labelledBy} className="flex flex-col rounded-md border border-hairline md:hidden">
        {views.map((session) => (
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
            {!session.current && <EndSessionButton session={session} height="h-11" />}
          </li>
        ))}
      </ul>
      <div className="relative hidden overflow-x-auto rounded-md border border-hairline md:block">
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
            {views.map((session) => (
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
                    <EndSessionButton session={session} height="h-8" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
