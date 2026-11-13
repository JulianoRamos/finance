import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { type ApiState, apiState } from '@/api/health';
import { currentSession } from '@/api/sessions';

import { PageBody, PageHeader } from '../_shell/app-shell';

// A página inicial provisória: o nome do produto e o estado da api, dentro da estrutura do app. O
// conteúdo dela chega com o KAN-14.

const SIGNAL: Record<ApiState, { text: string; color: string }> = {
  up: { text: 'API no ar', color: 'bg-positive' },
  no_database: { text: 'API no ar, sem o banco', color: 'bg-warning-strong' },
  down: { text: 'API fora do ar', color: 'bg-negative-strong' },
};

export default async function Home() {
  // Renderiza a cada requisição, no servidor: o estado é o de agora, e não o da hora do build.
  await connection();
  // O layout não roda de novo na navegação dentro do app: a página confere a sessão também, sem outra
  // ida à api quando o layout já a pediu nesta requisição.
  const [session, state] = await Promise.all([currentSession(), apiState()]);
  if (session.status === 'unauthenticated') redirect('/login');
  const signal = SIGNAL[state];

  return (
    <>
      <PageHeader title="finance" />
      <PageBody>
        <p role="status" className="flex items-center gap-2 text-label text-ink">
          <span aria-hidden="true" className={`size-2 rounded-full ${signal.color}`} />
          {signal.text}
        </p>
      </PageBody>
    </>
  );
}
