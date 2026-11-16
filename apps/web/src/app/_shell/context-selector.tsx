'use client';

import { Building2, Check, ChevronsUpDown, User, Users } from 'lucide-react';
import Link from 'next/link';
import { Popover } from 'radix-ui';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import type { ContextOptionGroup, ContextOptions } from '@/api/financial-context';

import { FOCUS_RING } from '../_access/access-screen';
import { chooseFinancialContextAction, searchFinancialContextsAction } from './context-actions';
import { Hint } from './hint';
import { MENU_PANEL } from './menu';
import { SEARCH_DELAY_MS } from './pagination';

/** O ícone do tipo do contexto: grupo, pessoa física ou empresa. */
export type ContextIcon = 'group' | 'individual' | 'company';

/** O contexto atual, como o seletor o mostra. */
export interface SelectedContext {
  readonly reference: string;
  readonly name: string;
  /** A linha abaixo do nome: o tipo e, num grupo, o resumo. */
  readonly summary: string;
  readonly icon: ContextIcon;
}

/** O que o seletor mostra: o contexto atual, `none` sem nenhum, ou `unavailable` quando a api não respondeu. */
export type ShownContext = SelectedContext | 'none' | 'unavailable';

/** O nome e a linha abaixo dele quando não há um contexto atual. */
const NO_CONTEXT = {
  none: { name: 'Nenhum contexto', summary: 'Cadastre uma entidade' },
  unavailable: { name: 'Contexto indisponível', summary: 'Tente de novo em instantes' },
} as const;

const ICONS = { group: Users, individual: User, company: Building2 } as const;

/** Os grupos do seletor, na ordem dele: a chave das escolhas, o rótulo e o ícone. */
const OPTION_GROUPS = [
  { key: 'groups', label: 'Grupos', icon: 'group' },
  { key: 'individuals', label: 'Pessoas físicas', icon: 'individual' },
  { key: 'companies', label: 'Empresas', icon: 'company' },
] as const;

/** O ícone do tipo num quadrado com borda `hairline` (design-system.md, seção 4.1). */
function IconBox({ icon }: Readonly<{ icon: ContextIcon }>) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 flex-none items-center justify-center rounded-sm border border-hairline bg-surface text-ink"
    >
      <Icon size={16} strokeWidth={1.5} />
    </span>
  );
}

/** Um grupo do seletor: o rótulo, as escolhas, o atual marcado e quantos ficaram de fora. */
function OptionGroup({
  label,
  icon,
  group,
  current,
  onChoose,
}: Readonly<{
  label: string;
  icon: ContextIcon;
  group: ContextOptionGroup;
  current: string | null;
  onChoose: (reference: string, name: string) => void;
}>) {
  const labelId = useId();
  if (group.total === 0) return null;
  const left = group.total - group.items.length;
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1">
      <span id={labelId} className="px-2 pt-2 pb-1 font-mono text-eyebrow text-mute uppercase">
        {label}
      </span>
      {group.items.map((option) => {
        const selected = option.reference === current;
        return (
          <button
            key={option.reference}
            type="button"
            aria-current={selected ? 'true' : undefined}
            onClick={() => {
              onChoose(option.reference, option.name);
            }}
            className={`flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-ink hover:bg-surface-subtle aria-[current=true]:bg-accent-soft ${FOCUS_RING}`}
          >
            <IconBox icon={icon} />
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {selected && <Check size={16} strokeWidth={1.5} aria-hidden="true" className="flex-none" />}
          </button>
        );
      })}
      {left > 0 && <p className="px-2 py-1 text-body-sm text-mute">Mais {String(left)}. Refine a busca.</p>}
    </div>
  );
}

/**
 * O seletor de contexto financeiro, no topo da barra lateral (design-system.md, seção 4.1): o contexto
 * atual e, aberto, a lista com a busca pela api, agrupada em Grupos, Pessoas físicas e Empresas.
 */
export function ContextSelector({ shown, expanded }: Readonly<{ shown: ShownContext; expanded: boolean }>) {
  const current = typeof shown === 'string' ? null : shown;
  const { name, summary } = typeof shown === 'string' ? NO_CONTEXT[shown] : shown;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ContextOptions | null | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');
  const [, startTransition] = useTransition();
  const latest = useRef(0);

  // Pede as escolhas da busca à api quando o seletor abre e depois de cada pausa na digitação; só a
  // resposta do pedido mais recente vale.
  useEffect(() => {
    if (!open) return;
    const request = ++latest.current;
    const timer = setTimeout(() => {
      void searchFinancialContextsAction(query).then((found) => {
        if (request === latest.current) setOptions(found);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [open, query]);

  // Fechar pelo estado não passa pelo onOpenChange do Radix: a busca volta ao começo aqui também.
  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(reference: string, chosenName: string) {
    close();
    if (reference === current?.reference) return;
    startTransition(async () => {
      await chooseFinancialContextAction(reference);
      setAnnouncement(`Contexto: ${chosenName}`);
    });
  }

  const shape = expanded
    ? 'size-10 justify-center lg:h-12 lg:w-full lg:justify-start lg:px-2'
    : 'size-10 justify-center';
  return (
    <>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true);
          else close();
        }}
      >
        <Hint label={`Contexto: ${name}`} expanded={expanded}>
          <Popover.Trigger
            className={`group mb-4 flex flex-none cursor-pointer items-center gap-2 rounded-sm hover:bg-surface-subtle aria-expanded:bg-accent-soft ${shape} ${FOCUS_RING}`}
          >
            <IconBox icon={current?.icon ?? 'group'} />
            <span
              className={
                expanded ? 'sr-only text-left lg:not-sr-only lg:flex lg:min-w-0 lg:flex-1 lg:flex-col' : 'sr-only'
              }
            >
              <span className="truncate text-label text-ink">
                <span className="sr-only">Contexto: </span>
                {name}
              </span>
              <span className="truncate text-body-sm text-mute group-aria-expanded:text-body">{summary}</span>
            </span>
            {expanded && (
              <ChevronsUpDown
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className="ml-auto hidden flex-none text-body lg:block"
              />
            )}
          </Popover.Trigger>
        </Hint>
        <Popover.Portal>
          <Popover.Content
            side="right"
            align="start"
            sideOffset={8}
            aria-label="Contexto financeiro"
            className={`${MENU_PANEL} max-h-(--radix-popover-content-available-height) overflow-y-auto`}
          >
            <input
              type="search"
              aria-label="Buscar entidade ou grupo"
              placeholder="Buscar entidade ou grupo"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className={`h-9 rounded-sm border border-hairline bg-surface px-2 text-body-md text-ink placeholder:text-mute ${FOCUS_RING}`}
            />
            {options === null && (
              <p role="alert" className="px-2 py-1 text-body-sm text-negative">
                Não foi possível carregar os contextos. Tente de novo em instantes.
              </p>
            )}
            {options && (
              <>
                {OPTION_GROUPS.map(({ key, label, icon }) => (
                  <OptionGroup
                    key={key}
                    label={label}
                    icon={icon}
                    group={options[key]}
                    current={current?.reference ?? null}
                    onChoose={choose}
                  />
                ))}
                {OPTION_GROUPS.every(({ key }) => options[key].total === 0) && (
                  <p className="px-2 py-1 text-body-sm text-mute">Nenhum contexto com esse nome.</p>
                )}
              </>
            )}
            <div className="h-px bg-hairline" />
            <Link
              href="/entities"
              onClick={close}
              className={`flex h-9 items-center rounded-sm px-2 text-ink hover:bg-surface-subtle ${FOCUS_RING}`}
            >
              Gerenciar entidades e grupos
            </Link>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
