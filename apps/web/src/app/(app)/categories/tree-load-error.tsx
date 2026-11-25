'use client';

import { useRouter } from 'next/navigation';

import { ErrorNotice } from '../../_access/fields';
import { SECONDARY_BUTTON } from '../../_shell/buttons';

/** O erro de carregamento da árvore, com "Tentar de novo", que a lê de novo (design-system.md, seção 4.5). */
export function TreeLoadError() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <ErrorNotice>Não foi possível carregar as categorias. Confira a conexão e tente de novo.</ErrorNotice>
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
