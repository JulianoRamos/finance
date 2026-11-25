import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { listCategories } from '@/api/categories';

import { ErrorNotice } from '../../_access/fields';
import { PageHeader } from '../../_shell/app-shell';
import { lastPageOf } from '../../_shell/list-page';
import { formatMonth, todayCalendarDate } from '../../_shell/format';
import { UrlPagination } from '../../_shell/url-pagination';
import { categoriesHref, type CategoryParams } from '../../_shell/category-text';
import { categoryParams } from './category-params';
import { CategoryToolbar } from './category-toolbar';
import { CategoryTree } from './category-tree';
import { NewCategory } from './new-category';
import { TreeLoadError } from './tree-load-error';

export const metadata: Metadata = { title: 'Categorias · finance' };

/** A árvore da aba e da busca do endereço, com a paginação, depois de a página chegar da api. */
async function TreeBody({ params }: Readonly<{ params: CategoryParams }>) {
  await connection();
  const list = await listCategories({
    nature: params.nature,
    page: params.page,
    q: params.q,
    onlyActive: !params.showInactive,
  });
  if (list.status === 'unauthenticated') redirect('/login');
  if (list.status === 'forbidden') {
    return (
      <div className="p-4">
        <ErrorNotice>Você não tem acesso a nenhuma pessoa física, e as categorias são delas.</ErrorNotice>
      </div>
    );
  }
  if (list.status !== 'ok') return <TreeLoadError />;
  const last = lastPageOf(list.data);
  if (last !== null) redirect(categoriesHref({ ...params, page: last }));
  return (
    <>
      <CategoryTree params={params} items={list.data.items} month={formatMonth(todayCalendarDate())} />
      {list.data.total > 0 && (
        <div className="px-4 pb-3">
          <UrlPagination page={list.data} label="Paginação das categorias" />
        </div>
      )}
    </>
  );
}

/** A árvore enquanto carrega: blocos cinza no formato dela, e não um indicador girando (design-system.md, seção 4.5). */
function TreeSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando as categorias" className="flex flex-col gap-3 p-4">
      {['ml-0', 'ml-8', 'ml-8', 'ml-0', 'ml-0'].map((indent, index) => (
        <div key={index} className={`h-9 rounded-sm bg-surface-subtle ${indent}`} />
      ))}
    </div>
  );
}

/**
 * A tela Categorias (design-system.md, seção 4.6): a árvore das pessoas físicas num cartão, com as abas
 * Despesas e Receitas, a busca, o "Mostrar desativadas" e a paginação no rodapé. O estado fica no endereço.
 */
export default async function Categories({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const params = categoryParams(await searchParams);
  return (
    <>
      <PageHeader title="Categorias" actions={<NewCategory nature={params.nature} />}>
        A árvore das pessoas físicas, que todas compartilham.
      </PageHeader>
      <div className="px-4 py-8 lg:px-10">
        <section aria-labelledby="category-tree-title" className="rounded-md border border-hairline bg-surface">
          <h2 id="category-tree-title" className="sr-only">
            Árvore de categorias
          </h2>
          <CategoryToolbar params={params} />
          <Suspense key={categoriesHref(params)} fallback={<TreeSkeleton />}>
            <TreeBody params={params} />
          </Suspense>
        </section>
      </div>
    </>
  );
}
