import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { type FinancialContext, currentFinancialContext } from '@/api/financial-context';
import { type ApiState, apiState } from '@/api/health';
import { currentSession } from '@/api/sessions';

import { Card, PageBody, PageHeader } from '../_shell/app-shell';
import { contextType, entitiesCount } from '../_shell/context-text';
import { LoadError } from '../_shell/load-error';
import { EntityBadge } from './entities/entity-badge';

// O Início (protótipo Inicio): o contexto financeiro escolhido e as entidades que ele reúne, e o estado
// da api. Os números do contexto chegam com as próximas fases.

const SIGNAL: Record<ApiState, { text: string; color: string }> = {
  up: { text: 'API no ar', color: 'bg-positive' },
  no_database: { text: 'API no ar, sem o banco', color: 'bg-warning-strong' },
  down: { text: 'API fora do ar', color: 'bg-negative-strong' },
};

/** A frase do que o contexto reúne, e, na Visão Familiar, como as empresas entram nela. */
function gatheredText(context: FinancialContext): string {
  if (context.entities.length === 0) return 'Este contexto ainda não reúne nenhuma entidade.';
  const gathered = `Este contexto reúne ${entitiesCount(context)}.`;
  return context.isFamilyView
    ? `${gathered} As empresas entram só pelos repasses e pela participação societária.`
    : gathered;
}

/** O cartão do contexto: o nome com o selo do tipo, o que ele reúne e as entidades, com o selo de cada uma. */
function ContextCard({ context }: Readonly<{ context: FinancialContext }>) {
  return (
    <Card>
      <section aria-labelledby="context-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="context-title" className="text-heading-md wrap-anywhere text-ink">
            {context.name}
          </h2>
          <span className="flex-none rounded-full bg-accent-soft px-2 text-body-sm font-medium text-link">
            {contextType(context)}
          </span>
        </div>
        <p className="text-body-md text-body">{gatheredText(context)}</p>
        {context.entities.length > 0 && (
          <ul aria-label="Entidades do contexto" className="grid gap-3 sm:grid-cols-2">
            {context.entities.map((entity) => (
              <li
                key={entity.id}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline p-4"
              >
                <span className="min-w-0 font-medium wrap-anywhere text-ink">{entity.name}</span>
                <EntityBadge entity={entity} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}

export default async function Home() {
  // Renderiza a cada requisição, no servidor: o estado é o de agora, e não o da hora do build.
  await connection();
  // O layout não roda de novo na navegação dentro do app: a página confere a sessão também, sem outra
  // ida à api quando o layout já a pediu nesta requisição.
  const [session, state, current] = await Promise.all([currentSession(), apiState(), currentFinancialContext()]);
  if (session.status === 'unauthenticated' || current.status === 'unauthenticated') redirect('/login');
  const signal = SIGNAL[state];

  return (
    <>
      <PageHeader title="Início">Os números aparecem aqui conforme as próximas fases forem entrando.</PageHeader>
      <PageBody>
        {current.status === 'ok' && <ContextCard context={current.context} />}
        {current.status === 'none' && (
          <Card>
            <div className="flex flex-col gap-1">
              <h2 className="text-heading-md text-ink">Nenhum contexto financeiro</h2>
              <p className="text-body-md text-body">
                Você ainda não tem acesso a nenhuma entidade.{' '}
                <Link href="/entities/new" className="text-link underline">
                  Cadastre uma entidade
                </Link>{' '}
                para começar.
              </p>
            </div>
          </Card>
        )}
        {current.status === 'unavailable' && <LoadError>Não foi possível carregar o contexto financeiro.</LoadError>}
        <p role="status" className="flex items-center gap-2 text-label text-ink">
          <span aria-hidden="true" className={`size-2 rounded-full ${signal.color}`} />
          {signal.text}
        </p>
      </PageBody>
    </>
  );
}
