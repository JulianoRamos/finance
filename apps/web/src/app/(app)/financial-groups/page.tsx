import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listFinancialGroups } from '@/api/financial-groups';

import { OpenPage } from '../../_shell/open-page';

/** A tela Grupos financeiros abre a Visão Familiar, a primeira da lista, que sempre existe. */
export default async function FinancialGroups() {
  await connection();
  const list = await listFinancialGroups();
  if (list.status === 'unauthenticated') redirect('/login');
  // Sem a lista, a Coluna já mostra o erro de carregamento.
  const [first] = list.status === 'ok' ? list.data : [];
  return first ? <OpenPage href={`/financial-groups/${first.id}`} /> : null;
}
