'use client';

import { ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { FOCUS_RING } from '../../_access/access-screen';
import { ErrorNotice } from '../../_access/fields';
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECONDARY_ICON_BUTTON } from '../../_shell/buttons';
import { formatMonth, shiftMonth } from '../../_shell/format';
import { Hint } from '../../_shell/hint';
import { LIST_ITEM, LIST_ITEM_SELECTED, NewListItem } from '../../_shell/list-item';
import type { ListPage } from '../../_shell/list-page';
import { MoneyValue } from '../../_shell/money-value';
import { Pagination, SEARCH_DELAY_MS, useLatestRequest } from '../../_shell/pagination';
import { SearchBox } from '../../_shell/search-box';
import { listEntriesAction } from './actions';
import type { EntryListItem } from './entry-list-page';
import { entriesQuery, type EntryParams, entryParams, type EntryType } from './entry-text';
import { StatusBadge } from './installment-status';

/** As escolhas do filtro de tipo, na ordem do protótipo. */
const TYPE_FILTERS: readonly { readonly value: EntryType | null; readonly label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'expense', label: 'Despesas' },
  { value: 'revenue', label: 'Receitas' },
];

/** A página mostrada: a do estado do endereço, a falha dela, ou nula enquanto ela chega. */
interface Loaded {
  readonly key: string;
  readonly page: ListPage<EntryListItem> | null;
  readonly failed: boolean;
}

/**
 * A Coluna da tela (design-system.md, seção 4.1): o mês, com as setas, o filtro de tipo, a busca na
 * descrição e as parcelas do mês de 10 em 10, com a Paginação no rodapé. O estado fica no endereço, que
 * os links dos itens levam junto; cada mudança é um pedido à api. A página de partida, a do mês corrente
 * sem filtro, vem do servidor.
 */
export function EntryList({
  initial,
  currentMonth,
}: Readonly<{ initial: ListPage<EntryListItem>; currentMonth: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // O segmento abaixo do layout da tela: `new` na criação, e o id do lançamento no detalhe.
  const segment = useSelectedLayoutSegment();
  const params = useMemo(() => entryParams((key) => searchParams.get(key), currentMonth), [searchParams, currentMonth]);
  const key = entriesQuery(params, currentMonth);
  // A página pedida à api para um estado fora do de partida, que o servidor já mandou.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const { request } = useLatestRequest();
  // O estado e o caminho mais recentes, que a busca adiada e o pedido leem: o filtro escolhido enquanto a
  // busca espera a última tecla não volta atrás, e o estado igual com outro objeto não pede de novo.
  const latest = useRef({ params, pathname });
  useEffect(() => {
    latest.current = { params, pathname };
  });

  // Um estado fora do de partida é pedido à api, de novo também quando a página de partida muda, como
  // depois de registrar um lançamento.
  useEffect(() => {
    if (key === '') return;
    void request(() => listEntriesAction(latest.current.params)).then((result) => {
      if (result) setLoaded({ key, page: result.ok ? result.page : null, failed: !result.ok });
    });
  }, [key, initial, request]);

  const [query, setQuery] = useState(params.q);
  const [shownQ, setShownQ] = useState(params.q);
  if (params.q !== shownQ) {
    // A busca mudou pelo endereço, como no "Limpar a busca": o campo acompanha.
    setShownQ(params.q);
    setQuery(params.q);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  function go(changes: Partial<EntryParams>) {
    const next = { ...latest.current.params, page: 1, ...changes };
    router.replace(`${latest.current.pathname}${entriesQuery(next, currentMonth)}`, { scroll: false });
  }

  const current = loaded?.key === key ? loaded : null;
  const page = key === '' ? initial : (current?.page ?? null);
  const failed = key !== '' && current?.failed === true;
  const monthText = formatMonth(`${params.month}-01`);
  const creating = segment === 'new';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <MonthButton
          label="Mês anterior"
          onClick={() => {
            go({ month: shiftMonth(params.month, -1) });
          }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        </MonthButton>
        <span className="text-label text-ink" aria-live="polite">
          {monthText}
        </span>
        <MonthButton
          label="Próximo mês"
          onClick={() => {
            go({ month: shiftMonth(params.month, 1) });
          }}
        >
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </MonthButton>
      </div>
      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-3 gap-1 rounded-sm bg-surface-subtle p-1">
        {TYPE_FILTERS.map((filter) => (
          <label
            key={filter.label}
            className="flex h-8 cursor-pointer items-center justify-center rounded-sm text-label text-body has-checked:bg-surface has-checked:text-ink has-checked:shadow-sussurro has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input
              type="radio"
              name="entry-type"
              checked={params.type === filter.value}
              onChange={() => {
                go({ type: filter.value });
              }}
              className="sr-only"
            />
            {filter.label}
          </label>
        ))}
      </div>
      <SearchBox
        id="entry-search"
        label="Buscar lançamento"
        query={query}
        onSearch={(text) => {
          setQuery(text);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            go({ q: text });
          }, SEARCH_DELAY_MS);
        }}
      />
      {failed && <ErrorNotice>Não foi possível carregar os lançamentos. Tente de novo.</ErrorNotice>}
      {!failed && page === null && <ListSkeleton />}
      {page !== null && (
        <>
          {page.total === 0 && !creating && (
            <EmptyMonth
              monthText={monthText}
              q={params.q.trim()}
              onClear={() => {
                go({ q: '' });
              }}
            />
          )}
          <ul aria-label={`Lançamentos de ${monthText}`} className="flex flex-col gap-1">
            {creating && <NewListItem label="Novo lançamento" detail="Ainda não salvo" />}
            {page.items.map((item) => {
              const selected = item.entryId === segment;
              return (
                <li key={item.id}>
                  <Link
                    href={`/entries/${item.entryId}${key}`}
                    aria-current={selected ? 'page' : undefined}
                    className={`${LIST_ITEM} ${selected ? LIST_ITEM_SELECTED : 'hover:bg-surface-subtle'} text-ink ${FOCUS_RING}`}
                  >
                    <span className="flex items-start justify-between gap-2 font-medium">
                      <span className="min-w-0 wrap-anywhere">{item.description}</span>
                      <MoneyValue
                        amount={item.amount}
                        direction={item.type === 'revenue' ? 'inflow' : 'outflow'}
                        className="flex-none"
                      />
                    </span>
                    {/* O mute não tem contraste sobre o accent-soft do item marcado. */}
                    <span className="flex items-start justify-between gap-2 text-body-sm">
                      <span className={`min-w-0 wrap-anywhere ${selected ? 'text-body' : 'text-mute'}`}>
                        {item.meta}
                      </span>
                      <StatusBadge status={item.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {page.total > 0 && (
            <Pagination
              page={page.page}
              pageSize={page.pageSize}
              total={page.total}
              label="Paginação dos lançamentos"
              onPage={(next) => {
                go({ page: next });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Um botão de ícone das setas do mês, com a dica. */
function MonthButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <Hint label={label} expanded={false} side="bottom">
      <button type="button" aria-label={label} onClick={onClick} className={SECONDARY_ICON_BUTTON}>
        {children}
      </button>
    </Hint>
  );
}

/**
 * O mês sem lançamento: sem busca, o estado vazio, com a ação que resolve; com a busca, o que ela procura
 * e o "Limpar a busca" (design-system.md, seção 4.5).
 */
function EmptyMonth({ monthText, q, onClear }: Readonly<{ monthText: string; q: string; onClear: () => void }>) {
  if (q !== '') {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
        <p className="text-ink">
          Nenhum lançamento com “{q}” em {monthText}.
        </p>
        <p className="text-body-sm text-mute">
          A busca procura na descrição dos lançamentos do mês e do tipo escolhidos.
        </p>
        <button type="button" onClick={onClear} className={SECONDARY_BUTTON}>
          Limpar a busca
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
      <ReceiptText size={20} strokeWidth={1.5} aria-hidden="true" className="text-mute" />
      <p className="text-ink">Nenhum lançamento em {monthText}.</p>
      <Link href="/entries/new" className={PRIMARY_BUTTON}>
        Registrar lançamento
      </Link>
    </div>
  );
}

/** A lista enquanto a página chega: blocos cinza no formato dela (design-system.md, seção 4.5). */
function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando os lançamentos" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((block) => (
        <div key={block} className="h-12 rounded-sm bg-surface-subtle" />
      ))}
    </div>
  );
}
