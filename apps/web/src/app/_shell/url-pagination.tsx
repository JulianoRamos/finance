'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { ListPage } from './list-page';
import { Pagination } from './pagination';
import { withSearchParam } from './search-params';

/**
 * A Paginação ligada ao `?page=` da URL, para a lista que o servidor lê: trocar de página pede a página
 * nova ao servidor, que a lê na api. Os outros parâmetros do endereço, como a data do saldo, ficam.
 */
export function UrlPagination({
  page: { page, pageSize, total },
  label,
}: Readonly<{ page: ListPage<unknown>; label?: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      {...(label === undefined ? {} : { label })}
      onPage={(next) => {
        router.push(withSearchParam(pathname, searchParams, 'page', String(next)), { scroll: false });
      }}
    />
  );
}
