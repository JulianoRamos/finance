import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { listEntities } from '@/api/entities';

import { PRIMARY_BUTTON } from '../../_shell/buttons';
import { OpenEntity } from './open-entity';

/** A tela Entidades abre a primeira entidade da lista ou, sem nenhuma, o estado vazio. */
export default async function Entities() {
  await connection();
  const list = await listEntities();
  if (list.status === 'unauthenticated') redirect('/login');
  // Sem a lista, a Coluna já mostra o erro de carregamento.
  if (list.status !== 'ok') return null;
  const [first] = list.entities;
  if (first) return <OpenEntity id={first.id} />;
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-hairline bg-surface p-4 md:p-6">
      <Building2 size={20} strokeWidth={1.5} aria-hidden="true" className="text-mute" />
      <p className="text-ink">Nenhuma entidade ainda. Cadastre as pessoas e as empresas da família.</p>
      <Link href="/entities/new" className={PRIMARY_BUTTON}>
        Nova entidade
      </Link>
    </div>
  );
}
