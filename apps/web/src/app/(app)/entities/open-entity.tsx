'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Abre a entidade do id no lugar da página atual, pelo roteador do navegador. A tela Entidades usa isto
 * para ir à primeira entidade, em vez do `redirect` na renderização do servidor: numa navegação dentro
 * do app, o redirect interrompe a página, e o modo de desenvolvimento do React falha ao medir o tempo
 * dela ("cannot have a negative time stamp").
 */
export function OpenEntity({ id }: Readonly<{ id: string }>) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/entities/${id}`);
  }, [router, id]);
  return null;
}
