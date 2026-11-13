import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { type ApiState, apiState } from '@/api/health';
import { currentSession } from '@/api/sessions';

// A página inicial provisória: o nome do produto, o usuário da sessão e o estado da api. Some quando a
// estrutura do app chegar.

const SIGNAL: Record<ApiState, { text: string; color: string }> = {
  up: { text: 'API no ar', color: 'bg-positive' },
  no_database: { text: 'API no ar, sem o banco', color: 'bg-warning-strong' },
  down: { text: 'API fora do ar', color: 'bg-negative-strong' },
};

export default async function Home() {
  // Renderiza a cada requisição, no servidor: o estado é o de agora, e não o da hora do build.
  await connection();
  // Sem uma sessão válida, o usuário entra antes. Quando a api não responde, a página mostra o estado
  // dela, sem dados de ninguém.
  const session = await currentSession();
  if (session.status === 'unauthenticated') redirect('/login');
  const signal = SIGNAL[await apiState()];

  return (
    <main className="flex flex-col gap-4 px-4 py-10 lg:px-10">
      <h1 className="text-heading-lg text-ink">finance</h1>
      {session.status === 'authenticated' && (
        <p className="text-body-md text-body">Você entrou como {session.user.name}.</p>
      )}
      <p role="status" className="flex items-center gap-2 text-label text-ink">
        <span aria-hidden="true" className={`size-2 rounded-full ${signal.color}`} />
        {signal.text}
      </p>
    </main>
  );
}
