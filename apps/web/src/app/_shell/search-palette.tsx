'use client';

import { ArrowRightLeft, CornerDownLeft, ListTree, Lock, type LucideIcon, Search, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { SearchResults } from '@/api/search';

import { FOCUS_RING } from '../_access/access-screen';
import { accountBadge, bankText } from './account-text';
import { categoriesHref, categoryPath, NATURE_TEXT } from './category-text';
import { SECONDARY_BUTTON } from './buttons';
import { CONTEXT_ICONS, useContextSelector } from './context-selector';
import { groupCountsSummary } from './context-text';
import { TYPE_BADGES } from './entity-type';
import { Hint } from './hint';
import { type PaletteEntry, paletteEntriesFor } from './pages';
import { SEARCH_DELAY_MS } from './pagination';
import { searchAction } from './search-actions';
import { highlight, MAX_TERM_LENGTH, MIN_TERM_LENGTH } from './search-text';

/** O que escolher uma opção faz: abrir um caminho, trocar o contexto ou abrir o seletor de contexto. */
type OptionRun =
  | { readonly kind: 'open'; readonly href: string }
  | { readonly kind: 'context'; readonly reference: string }
  | { readonly kind: 'selector' };

/** Uma opção da paleta: o nome, o ícone, o complemento à direita e o que escolhê-la faz. */
interface Option {
  readonly key: string;
  readonly icon: LucideIcon;
  /** O texto antes do nome, como "Trocar para", que não é destacado. */
  readonly prefix?: string;
  readonly name: string;
  /** O complemento em `mute` depois do nome: o e-mail, o resumo do grupo, a dona e o banco da conta, a seção do destino. */
  readonly detail?: string;
  /** O selo à direita: o tipo da entidade, "Reserva" na conta, "Desativada", ou "Desativado" no usuário. */
  readonly badge?: string;
  readonly run: OptionRun;
}

/** Um grupo da paleta, com o rótulo e as opções dele. */
interface OptionGroup {
  readonly label: string;
  readonly options: readonly Option[];
}

/** A resposta da api para um termo; `data` nula quando ela não respondeu. */
interface Found {
  readonly term: string;
  readonly data: SearchResults | null;
}

/** O atalho como o sistema o escreve: ⌘K no Mac, Ctrl K nos outros; no servidor, que não sabe, ⌘K. */
function useShortcutLabel(): string {
  return useSyncExternalStore(
    () => () => undefined,
    () => (/Mac OS X|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  );
}

const KBD = 'rounded-sm border border-hairline bg-surface-subtle px-1 font-mono text-body-sm text-body';

/** Um destino ou uma ação que abre uma página, como opção da paleta. */
function entryOption(group: string, entry: PaletteEntry): Option {
  return {
    key: `${group}:${entry.label}`,
    icon: entry.icon,
    name: entry.label,
    ...(entry.section !== undefined && { detail: entry.section }),
    run: { kind: 'open', href: entry.href },
  };
}

/** A ação que fecha a paleta e abre o seletor de contexto da barra lateral. */
const CHOOSE_CONTEXT: Option = {
  key: 'action:context',
  icon: ArrowRightLeft,
  name: 'Trocar o contexto financeiro',
  run: { kind: 'selector' },
};

/** Os grupos dos registros que a api achou, na ordem da paleta (design-system.md, seção 4.5). */
function recordGroups(data: SearchResults): OptionGroup[] {
  const contexts: Option[] = [
    ...data.financialGroups.map((group) => ({ reference: `group:${group.id}`, name: group.name })),
    ...data.entities
      .filter((entity) => entity.active)
      .map((entity) => ({ reference: `entity:${entity.id}`, name: entity.name })),
  ].map(({ reference, name }) => ({
    key: `context:${reference}`,
    icon: ArrowRightLeft,
    prefix: 'Trocar para',
    name,
    run: { kind: 'context', reference },
  }));
  return [
    {
      label: 'Entidades',
      options: data.entities.map((entity) => ({
        key: `entity:${entity.id}`,
        icon: CONTEXT_ICONS[entity.type],
        name: entity.name,
        badge: entity.active ? TYPE_BADGES[entity.type] : 'Desativada',
        run: { kind: 'open', href: `/entities/${entity.id}` },
      })),
    },
    {
      label: 'Grupos financeiros',
      options: data.financialGroups.map((group) => ({
        key: `group:${group.id}`,
        icon: CONTEXT_ICONS.group,
        name: group.name,
        detail: groupCountsSummary(group),
        run: { kind: 'open', href: `/financial-groups/${group.id}` },
      })),
    },
    {
      label: 'Contas',
      options: data.accounts.map((account) => {
        const badge = accountBadge(account);
        return {
          key: `account:${account.id}`,
          icon: Wallet,
          name: account.name,
          detail: `${account.entityName} · ${bankText(account)}`,
          ...(badge !== null && { badge }),
          run: { kind: 'open', href: `/accounts/${account.id}` },
        };
      }),
    },
    {
      label: 'Categorias',
      options: data.categories.map((category) => {
        const nature = NATURE_TEXT[category.nature].label;
        return {
          key: `category:${category.id}`,
          icon: ListTree,
          name: category.name,
          detail:
            category.parentName === null ? nature : `${nature} · ${categoryPath(category.name, category.parentName)}`,
          ...(!category.active && { badge: 'Desativada' }),
          // A categoria abre a árvore da natureza dela, com a busca pelo nome (LLD, regra 6.22).
          run: { kind: 'open', href: categoriesHref({ nature: category.nature, q: category.name }) },
        };
      }),
    },
    {
      label: 'Usuários',
      options: data.users.map((user) => ({
        key: `user:${user.id}`,
        icon: Lock,
        name: user.name,
        detail: user.email,
        ...(!user.active && { badge: 'Desativado' }),
        run: { kind: 'open', href: `/users/${user.id}` },
      })),
    },
    { label: 'Contextos', options: contexts },
  ];
}

/** O que a lista mostra: os grupos com opções, e se a resposta do termo atual chegou ou falhou. */
interface PaletteList {
  readonly groups: readonly OptionGroup[];
  /** O termo tem resposta da api: os registros, ou nula quando ela não respondeu. */
  readonly answered: boolean;
  readonly unavailable: boolean;
}

/**
 * A lista da paleta para o termo, aparado: sem ele, as sugestões (todos os destinos e as ações); com ele,
 * os registros, e depois os destinos e as ações que casam. Enquanto o termo novo não tem resposta, os
 * registros da anterior ficam, só os que ainda casam com ele.
 */
function paletteList(
  text: string,
  found: Found | undefined,
  entries: { readonly destinations: readonly PaletteEntry[]; readonly actions: readonly PaletteEntry[] },
): PaletteList {
  const searching = text.length >= MIN_TERM_LENGTH;
  const answered = searching && found?.term === text;
  const matches = (option: Option) => !searching || highlight(option.name, text) !== null;
  const records = searching && found?.data ? recordGroups(found.data) : [];
  const groups: OptionGroup[] = [
    ...(answered ? records : records.map((group) => ({ ...group, options: group.options.filter(matches) }))),
    { label: 'Ir para', options: entries.destinations.map((entry) => entryOption('goto', entry)).filter(matches) },
    {
      label: 'Ações',
      options: [...entries.actions.map((entry) => entryOption('action', entry)), CHOOSE_CONTEXT].filter(matches),
    },
  ];
  return {
    groups: groups.filter((group) => group.options.length > 0),
    answered,
    unavailable: answered && found.data === null,
  };
}

/** O nome com o trecho que casa com o termo destacado em `accent-soft`. */
function HighlightedName({ name, term }: Readonly<{ name: string; term: string }>) {
  const parts = highlight(name, term);
  if (!parts) return name;
  return (
    <>
      {parts.before}
      <mark className="rounded-sm bg-accent-soft text-ink">{parts.match}</mark>
      {parts.after}
    </>
  );
}

/**
 * A paleta de pesquisa (design-system.md, seção 4.5), aberta pelo campo "Pesquisar…" da barra superior e
 * por ⌘K ou Ctrl+K: um diálogo com o campo em combobox e a lista agrupada. Sem termo, sugere os destinos e
 * as ações; com ele, pesquisa os registros na api e filtra os destinos e as ações na web.
 */
export function SearchPalette({ managesAccess }: Readonly<{ managesAccess: boolean }>) {
  const router = useRouter();
  const contextSelector = useContextSelector();
  const shortcut = useShortcutLabel();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [found, setFound] = useState<Found | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(0);
  // O que fazer depois que a paleta fecha, no lugar de devolver o foco a quem a abriu.
  const afterClose = useRef<(() => void) | null>(null);
  // O Enter dado antes de chegar a resposta do termo atual, que escolhe a primeira opção quando ela chega.
  const enterQueued = useRef(false);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${String(index)}`;

  // ⌘K ou Ctrl+K abre a paleta em qualquer tela da estrutura do app.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const text = term.trim();
  const searching = text.length >= MIN_TERM_LENGTH;

  const entries = paletteEntriesFor(managesAccess);
  const { groups: shownGroups, answered, unavailable } = paletteList(text, found, entries);
  const pending = searching && !answered;
  const options = shownGroups.flatMap((group) => group.options);
  const empty = answered && !unavailable && options.length === 0;

  // A primeira opção fica marcada sempre que a lista muda.
  const optionsKey = options.map((option) => option.key).join('|');
  const [lastOptionsKey, setLastOptionsKey] = useState(optionsKey);
  if (optionsKey !== lastOptionsKey) {
    setLastOptionsKey(optionsKey);
    setActive(0);
  }

  // A opção marcada fica à vista quando a lista rola.
  const activeId = optionId(active);
  useEffect(() => {
    if (open) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeId, optionsKey]);

  function close() {
    setOpen(false);
    setTerm('');
    setFound(undefined);
  }

  function choose(option: Option) {
    const { run } = option;
    if (run.kind === 'open') router.push(run.href);
    if (run.kind === 'context') contextSelector.choose(run.reference, option.name);
    if (run.kind === 'selector') {
      afterClose.current = () => {
        contextSelector.setOpen(true);
      };
    }
    close();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // O Enter que confirma um acento ou um caractere composto não escolhe a opção.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && pending) {
      event.preventDefault();
      enterQueued.current = true;
      return;
    }
    if (options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    }
  }

  // A resposta da api; o Enter dado enquanto ela não chegava escolhe a primeira opção da lista nova.
  const onAnswer = useEffectEvent((answer: Found) => {
    setFound(answer);
    if (!enterQueued.current) return;
    enterQueued.current = false;
    const first = paletteList(text, answer, entries).groups[0]?.options[0];
    if (first) choose(first);
  });

  // Pede os registros à api depois de cada pausa na digitação; a resposta de um termo que já mudou não vale.
  useEffect(() => {
    if (!open || !searching) return;
    let stale = false;
    const timer = setTimeout(() => {
      void searchAction(text)
        .catch(() => null)
        .then((data) => {
          if (!stale) onAnswer({ term: text, data });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, searching, text, retry]);

  let index = 0;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else close();
      }}
    >
      <Hint label="Pesquisar" expanded={false} side="bottom" hiddenFromMd>
        <Dialog.Trigger
          aria-keyshortcuts="Meta+K Control+K"
          className={`mr-1 inline-flex size-9 flex-none cursor-pointer items-center justify-center gap-2 rounded-sm text-body hover:bg-surface-subtle md:w-search md:justify-start md:border md:border-hairline md:bg-surface md:pr-2 md:pl-3 md:text-mute ${FOCUS_RING}`}
        >
          <Search size={16} strokeWidth={1.5} aria-hidden="true" className="flex-none" />
          {/* O nome é o texto visível, sem as reticências; abaixo de 768px, só o leitor de tela o lê. */}
          <span className="sr-only md:not-sr-only">
            Pesquisar<span aria-hidden="true">…</span>
          </span>
          <kbd aria-hidden="true" className={`ml-auto hidden md:inline ${KBD}`}>
            {shortcut}
          </kbd>
        </Dialog.Trigger>
      </Hint>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          // A 120px do topo no desktop (design-system.md, seção 4.5): `top-16` e `mt-14`, 64px e 56px, sem um
          // token de 120px; no celular, a 16px.
          className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-palette flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-flutuante md:top-16 md:mt-14"
          onCloseAutoFocus={(event) => {
            const next = afterClose.current;
            afterClose.current = null;
            if (!next) return;
            event.preventDefault();
            next();
          }}
        >
          <Dialog.Title className="sr-only">Pesquisar</Dialog.Title>
          <div className="flex h-14 flex-none items-center gap-3 border-b border-hairline px-4">
            <Search size={20} strokeWidth={1.5} aria-hidden="true" className="flex-none text-body" />
            <input
              role="combobox"
              aria-label="Pesquisar"
              aria-expanded={options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={options.length > 0 ? optionId(active) : undefined}
              autoComplete="off"
              placeholder="Pesquisar entidades, grupos, usuários e telas"
              value={term}
              maxLength={MAX_TERM_LENGTH}
              onChange={(event) => {
                enterQueued.current = false;
                setTerm(event.target.value);
              }}
              onKeyDown={onInputKeyDown}
              className="min-w-0 flex-1 bg-transparent text-body-lg text-ink outline-none placeholder:text-mute"
            />
            <kbd aria-hidden="true" className={KBD}>
              Esc
            </kbd>
          </div>
          {unavailable && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-negative">Não foi possível pesquisar agora.</span>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                onClick={() => {
                  setFound(undefined);
                  setRetry((count) => count + 1);
                }}
              >
                Tentar de novo
              </button>
            </div>
          )}
          {empty && (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <Search size={24} strokeWidth={1.5} aria-hidden="true" className="mb-2 text-mute" />
              <p className="font-medium wrap-anywhere text-ink">Nada encontrado para “{text}”</p>
              <p>A pesquisa procura entidades, grupos financeiros, usuários e telas.</p>
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label="Resultados"
            hidden={options.length === 0}
            className="max-h-(--container-palette-list) overflow-y-auto px-2 py-1"
          >
            {shownGroups.map((group) => (
              <PaletteGroup key={group.label} label={group.label}>
                {group.options.map((option) => {
                  const position = index++;
                  const selected = position === active;
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.key}
                      id={optionId(position)}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => {
                        if (!selected) setActive(position);
                      }}
                      onClick={() => {
                        choose(option);
                      }}
                      className="group flex h-10 flex-none cursor-pointer items-center gap-3 rounded-sm px-3 text-ink aria-selected:bg-surface-subtle"
                    >
                      <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="flex-none text-body" />
                      <span className="min-w-0 truncate">
                        {option.prefix !== undefined && `${option.prefix} `}
                        {searching ? <HighlightedName name={option.name} term={text} /> : option.name}
                      </span>
                      {option.detail !== undefined && (
                        <span className="min-w-0 shrink-4 truncate text-body-sm text-body">{option.detail}</span>
                      )}
                      <span className="ml-auto flex flex-none items-center gap-2">
                        {option.badge !== undefined && (
                          <span className="rounded-full bg-surface-subtle px-2 text-body-sm font-medium text-body group-aria-selected:bg-surface">
                            {option.badge}
                          </span>
                        )}
                        {selected && (
                          <CornerDownLeft size={16} strokeWidth={1.5} aria-hidden="true" className="text-body" />
                        )}
                      </span>
                    </div>
                  );
                })}
              </PaletteGroup>
            ))}
          </div>
          <div className="flex h-11 flex-none items-center gap-4 border-t border-hairline bg-surface-subtle px-4 text-body-sm text-body">
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↑</kbd>
              <kbd className={KBD}>↓</kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↵</kbd>
              abrir
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>Esc</kbd>
              fechar
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Um grupo da lista, com o rótulo em `eyebrow` `mute`. */
function PaletteGroup({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col py-1">
      <span id={labelId} className="px-3 pt-2 pb-1 font-mono text-eyebrow text-mute uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
