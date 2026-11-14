'use client';

import { createContext, type ReactNode, use, useState } from 'react';

/**
 * O usuário recém-criado no modo `criado`: a página do cadastro o informa, e a lista o marca no lugar do
 * item "Novo usuário", sem sair da página, que mostra o link uma vez só.
 */
const CreatedUserContext = createContext<{ id: string | null; set: (id: string | null) => void }>({
  id: null,
  set: () => undefined,
});

/** Guarda o usuário recém-criado para a lista e o cadastro, que ficam lado a lado na tela. */
export function CreatedUserProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [id, set] = useState<string | null>(null);
  return <CreatedUserContext value={{ id, set }}>{children}</CreatedUserContext>;
}

/** O usuário recém-criado, e como informá-lo. */
export function useCreatedUser() {
  return use(CreatedUserContext);
}
