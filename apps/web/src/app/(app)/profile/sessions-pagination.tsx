'use client';

import { usePathname, useRouter } from 'next/navigation';

import type { ListPage } from '../../_shell/list-page';
import { Pagination } from '../../_shell/pagination';

/**
 * A Paginação das sessões, ligada ao `?page=` da URL: trocar de página pede a página nova ao servidor,
 * que lê as sessões dela na api.
 */
export function SessionsPagination({ page: { page, pageSize, total } }: Readonly<{ page: ListPage<unknown> }>) {
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
