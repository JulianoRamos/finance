'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { ReactNode } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { SECONDARY_BUTTON } from '../../_shell/buttons';

const PANEL = 'flex flex-col gap-1 rounded-md border border-hairline bg-surface p-4';

/**
 * O corpo da tela Lançamentos (design-system.md, seção 4.1), como o de Contas: a Coluna e o Conteúdo lado
 * a lado a partir do desktop, um embaixo do outro no tablet e, no celular, um dos dois: a lista, na página
 * da lista, ou o item, na subpágina dele, com o link de volta à lista, que leva o estado do endereço. A
 * falha da lista fica na Coluna, e o item aparece.
 */
export function EntryColumns({ list, children }: Readonly<{ list: ReactNode | null; children: ReactNode }>) {
  // O segmento abaixo do layout: nulo na página da lista, `new` na criação, e o id do lançamento no item.
  const segment = useSelectedLayoutSegment();
  const searchParams = useSearchParams();
  const inItem = segment !== null;
  const query = searchParams.toString();
  return (
    <>
      <section aria-label="Lista de lançamentos" className={`${PANEL} ${inItem ? 'max-md:hidden' : ''}`}>
        {list ?? <ListLoadError />}
      </section>
      <div className={`flex min-w-0 flex-col gap-4 lg:col-span-2 ${inItem ? '' : 'max-md:hidden'}`}>
        {inItem && (
          <Link
            href={query === '' ? '/entries' : `/entries?${query}`}
            className={`inline-flex items-center gap-1 self-start rounded-sm text-label text-link md:hidden ${FOCUS_RING}`}
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Lançamentos
          </Link>
        )}
        {children}
      </div>
    </>
  );
}

/** O erro de carregamento da lista, com "Tentar de novo" (design-system.md, seção 4.5). */
function ListLoadError() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNotice>Não foi possível carregar os lançamentos. Confira a conexão e tente de novo.</ErrorNotice>
      <button
        type="button"
        className={SECONDARY_BUTTON}
        onClick={() => {
          router.refresh();
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}
