import type { ReactNode } from 'react';

import { ErrorNotice } from '../_access/fields';

/** O painel do Conteúdo quando a api não devolveu o que a página mostra, com o que faltou. */
export function LoadError({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6">
      <ErrorNotice>{children}</ErrorNotice>
    </div>
  );
}
