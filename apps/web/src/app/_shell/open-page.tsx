'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Abre o caminho dado no lugar da página atual, pelo roteador do navegador. As telas com a lista ao lado,
 * como Entidades, usam isto para ir ao primeiro item, em vez do `redirect` na renderização do servidor:
 * numa navegação dentro do app, o redirect interrompe a página, e o modo de desenvolvimento do React
 * falha ao medir o tempo dela ("cannot have a negative time stamp"). Com `media`, só abre quando a tela
 * casa com a consulta, como a partir do tablet, em que a lista e o item cabem juntos.
 */
export function OpenPage({ href, media }: Readonly<{ href: string; media?: string }>) {
  const router = useRouter();
  useEffect(() => {
    if (media === undefined || window.matchMedia(media).matches) router.replace(href);
  }, [router, href, media]);
  return null;
}
