import { connection } from 'next/server';

import { type EstadoApi, estadoDaApi } from '@/api/saude';

// A página inicial provisória: o nome do produto e o estado da api. Some quando a estrutura do app
// chegar.

const SINAL: Record<EstadoApi, { texto: string; cor: string }> = {
  no_ar: { texto: 'API no ar', cor: 'bg-positive' },
  sem_banco: { texto: 'API no ar, sem o banco', cor: 'bg-warning-strong' },
  fora_do_ar: { texto: 'API fora do ar', cor: 'bg-negative-strong' },
};

export default async function Inicio() {
  // Renderiza a cada requisição, no servidor: o estado é o de agora, e não o da hora do build.
  await connection();
  const sinal = SINAL[await estadoDaApi()];

  return (
    <main className="flex flex-col gap-4 px-4 py-10 lg:px-10">
      <h1 className="text-heading-lg text-ink">finance</h1>
      <p role="status" className="flex items-center gap-2 text-label text-ink">
        <span aria-hidden="true" className={`size-2 rounded-full ${sinal.cor}`} />
        {sinal.texto}
      </p>
    </main>
  );
}
