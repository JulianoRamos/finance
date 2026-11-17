'use client';

import { usePathname, useRouter } from 'next/navigation';

import type { ListPage } from './list-page';
import { Pagination } from './pagination';

/**
 * A Paginação ligada ao `?page=` da URL, para a lista que o servidor lê: trocar de página pede a página
 * nova ao servidor, que a lê na api.
 */
export function UrlPagination({ page: { page, pageSize, total } }: Readonly<{ page: ListPage<unknown> }>) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPage={(next) => {
        router.push(`${pathname}?page=${String(next)}`, { scroll: false });
      }}
    />
  );
}
