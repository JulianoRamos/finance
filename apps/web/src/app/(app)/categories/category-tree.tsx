'use client';

import { Ban, ChevronRight, Ellipsis, Move, Pencil, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
import { startTransition, useActionState, useCallback, useEffect, useState } from 'react';

import type { CategoryEdit, CategoryTreeItem, ParentChoice } from '@/api/categories';

import { ErrorNotice, inputClass } from '../../_access/fields';
import { GHOST_ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../_shell/buttons';
import { categoriesHref, type CategoryParams, NATURE_TEXT } from '../../_shell/category-text';
import { ConfirmDialog } from '../../_shell/confirm-dialog';
import { FormDialog, FormDialogCancel } from '../../_shell/form-dialog';
import { Hint } from '../../_shell/hint';
import { MENU_ITEM, MENU_ITEM_DESTRUCTIVE, MENU_LABEL, MENU_PANEL, MENU_SEPARATOR } from '../../_shell/menu';
import { highlight } from '../../_shell/search-text';
import { TemporaryNotice } from '../../_shell/temporary-notice';
import {
  type CategoryCommandResult,
  editCategoryAction,
  parentChoicesAction,
  setCategoryActiveAction,
} from './actions';
import { tabId } from './category-toolbar';
import { NewSubcategory } from './new-category';

/** Uma categoria da árvore, sem as subcategorias: a de primeiro nível ou uma subcategoria. */
type TreeCategory = CategoryTreeItem['children'][number];

/** O comando antes do primeiro envio. */
const NOT_SENT: CategoryCommandResult = { message: null, saved: null };

/** O caminho da categoria, como o menu e o campo do renomear o dizem ("Moradia › Energia"). */
function pathOf(category: TreeCategory, parent: TreeCategory | null): string {
  return parent === null ? category.name : `${parent.name} › ${category.name}`;
}

/** A edição da categoria lida com o nome ou o pai trocados, como a api a recebe, com a natureza e a versão lidas. */
function editOf(category: TreeCategory, changes: Partial<Pick<CategoryEdit, 'name' | 'parentId'>>) {
  const { id, version, name, parentId, nature } = category;
  return { id, version, name, parentId, nature, ...changes };
}

/** O nome da categoria com o trecho da busca marcado em `accent-soft`. */
function CategoryName({ category, q, level }: Readonly<{ category: TreeCategory; q: string; level: 1 | 2 }>) {
  const found = category.matched ? highlight(category.name, q) : null;
  const tone = !category.active || !category.matched ? 'text-mute' : level === 1 ? 'font-medium text-ink' : 'text-ink';
  return (
    <span className={`min-w-0 truncate ${tone}`}>
      {found ? (
        <>
          {found.before}
          <mark className="rounded-sm bg-accent-soft text-inherit">{found.match}</mark>
          {found.after}
        </>
      ) : (
        category.name
      )}
    </span>
  );
}

/** O selo "Desativada", neutro (design-system.md, seção 4.4). */
function InactiveBadge() {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-full bg-surface-subtle px-2 text-body-sm font-medium text-body">
      Desativada
    </span>
  );
}

/**
 * O renomear no lugar, na própria linha: o campo com o nome atual, o "Salvar" e o "Cancelar". O Enter
 * salva, e o Esc cancela.
 */
function RenameField({
  category,
  path,
  onDone,
}: Readonly<{ category: TreeCategory; path: string; onDone: () => void }>) {
  const [name, setName] = useState(category.name);
  const [state, dispatch, pending] = useActionState(editCategoryAction, NOT_SENT);
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);
  const fieldId = `rename-${category.id}`;
  function save() {
    startTransition(() => {
      dispatch(editOf(category, { name }));
    });
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 py-1">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <label htmlFor={fieldId} className="sr-only">
          Novo nome de {path}
        </label>
        <input
          id={fieldId}
          // O campo abre com o foco, porque o renomear vem do menu da própria linha.
          autoFocus
          value={name}
          aria-invalid={state.message !== null}
          aria-describedby={state.message !== null ? `${fieldId}-error` : `${fieldId}-help`}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onDone();
            }
          }}
          className={`${inputClass('app')} min-w-0 flex-1 md:max-w-form`}
        />
        <button type="button" disabled={pending} onClick={save} className={PRIMARY_BUTTON}>
          Salvar
        </button>
        <button type="button" onClick={onDone} className={SECONDARY_BUTTON}>
          Cancelar
        </button>
        <span id={`${fieldId}-help`} className="text-body-sm text-mute max-md:hidden">
          Enter salva, Esc cancela
        </span>
      </span>
      {state.message !== null && (
        <span id={`${fieldId}-error`} role="alert" className="text-body-sm text-negative">
          {state.message}
        </span>
      )}
    </span>
  );
}

/** O que o menu de uma linha pede à árvore. */
interface RowCommands {
  readonly rename: () => void;
  readonly move: () => void;
  readonly deactivate: () => void;
  readonly reactivate: () => void;
}

/**
 * O menu de ações da linha (design-system.md, seções 4.4 e 4.6): o caminho no rótulo, o Renomear, o
 * "Mover para…" e o Desativar, por último, em `negative`; na desativada, o Reativar e o Renomear.
 */
function RowMenu({
  category,
  path,
  commands,
  pending,
}: Readonly<{ category: TreeCategory; path: string; commands: RowCommands; pending: boolean }>) {
  const label = `Ações de ${category.name}`;
  const rename = (
    <DropdownMenu.Item className={MENU_ITEM} onSelect={commands.rename}>
      <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
      Renomear
    </DropdownMenu.Item>
  );
  return (
    <DropdownMenu.Root modal={false}>
      <Hint label={label} expanded={false} side="bottom">
        <DropdownMenu.Trigger
          aria-label={label}
          className={`inline-flex size-7 ${GHOST_ICON_BUTTON} aria-expanded:bg-surface-subtle`}
        >
          <Ellipsis size={16} strokeWidth={1.5} aria-hidden="true" />
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={MENU_PANEL}>
          <DropdownMenu.Label className={MENU_LABEL}>
            {category.active ? path : `${path} · desativada`}
          </DropdownMenu.Label>
          {category.active ? (
            <>
              {rename}
              <DropdownMenu.Item className={MENU_ITEM} onSelect={commands.move}>
                <Move size={16} strokeWidth={1.5} aria-hidden="true" />
                Mover para…
              </DropdownMenu.Item>
              <DropdownMenu.Separator className={MENU_SEPARATOR} />
              <DropdownMenu.Item className={MENU_ITEM_DESTRUCTIVE} disabled={pending} onSelect={commands.deactivate}>
                <Ban size={16} strokeWidth={1.5} aria-hidden="true" />
                Desativar categoria
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <DropdownMenu.Item className={MENU_ITEM} disabled={pending} onSelect={commands.reactivate}>
                <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                Reativar categoria
              </DropdownMenu.Item>
              {rename}
              <p className="max-w-menu px-2 pt-1 pb-2 text-body-sm text-mute">
                Desativada, ela não aparece nas escolhas dos lançamentos novos e continua nos que já tem.
              </p>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * O formulário do "Mover para…": a escolha do novo pai entre o primeiro nível e as categorias de primeiro
 * nível ativas da mesma natureza, pedidas à api quando o diálogo abre, com o lugar atual marcado como
 * "onde está".
 */
function MoveForm({
  category,
  parent,
  hasChildren,
  onSaved,
}: Readonly<{ category: TreeCategory; parent: TreeCategory | null; hasChildren: boolean; onSaved: () => void }>) {
  const [state, dispatch, pending] = useActionState(editCategoryAction, NOT_SENT);
  const [choices, setChoices] = useState<ParentChoice[] | null | undefined>(undefined);
  // `undefined` até a escolha; `null` é o primeiro nível.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);
  useEffect(() => {
    // A categoria com subcategorias fica no primeiro nível: não há para onde levá-la.
    if (hasChildren) return undefined;
    let current = true;
    void parentChoicesAction(category.nature)
      .catch(() => null)
      .then((loaded) => {
        if (current) setChoices(loaded);
      });
    return () => {
      current = false;
    };
  }, [category.nature, hasChildren]);
  if (hasChildren) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-body">
          Ela tem subcategorias, e por isso fica no primeiro nível: a árvore tem só dois níveis. Para mudá-la de lugar,
          mova antes as subcategorias dela.
        </p>
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <FormDialogCancel />
        </div>
      </div>
    );
  }
  const options: { id: string | null; name: string }[] = [
    { id: null, name: 'Primeiro nível' },
    ...(choices ?? []).filter((choice) => choice.id !== category.id),
  ];
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen === undefined) return;
        startTransition(() => {
          dispatch(editOf(category, { parentId: chosen }));
        });
      }}
    >
      {choices === undefined && <p className="text-body-sm text-mute">Carregando as categorias…</p>}
      {choices === null && <ErrorNotice>Não foi possível carregar as categorias. Tente de novo.</ErrorNotice>}
      <fieldset aria-describedby="move-help" className="flex flex-col rounded-md border border-hairline p-1">
        <legend className="sr-only">Novo pai</legend>
        {options.map((option) => {
          const current = option.id === (parent?.id ?? null);
          return (
            <label
              key={option.id ?? 'top'}
              className={`flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 has-checked:bg-accent-soft ${current ? 'text-mute' : 'text-ink'}`}
            >
              <input
                type="radio"
                name="parent"
                disabled={current}
                onChange={() => {
                  setChosen(option.id);
                }}
                className="size-4 accent-ink"
              />
              {current ? `${option.name} · onde está` : option.name}
            </label>
          );
        })}
      </fieldset>
      <p id="move-help" className="text-body-sm text-mute">
        Só as categorias de {NATURE_TEXT[category.nature].adjective}, como ela.
      </p>
      {state.message !== null && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <FormDialogCancel />
        <button type="submit" disabled={pending || chosen === undefined} className={PRIMARY_BUTTON}>
          Mover categoria
        </button>
      </div>
    </form>
  );
}

/**
 * A árvore de categorias de uma natureza (design-system.md, seção 4.6): as categorias de primeiro nível da
 * página, cada uma com as subcategorias recuadas, que recolhem; cada linha com o "+" da nova subcategoria,
 * no primeiro nível, e o menu de ações. Com a busca, mostra as que batem, com o trecho marcado, e o pai de
 * cada uma, em `mute`, com a etiqueta "categoria pai".
 */
export function CategoryTree({
  params,
  items,
  month,
}: Readonly<{
  params: CategoryParams;
  items: readonly CategoryTreeItem[];
  /** O mês da coluna do total, como "nov. de 2026". */
  month: string;
}>) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<{
    category: TreeCategory;
    parent: TreeCategory | null;
    hasChildren: boolean;
  } | null>(null);
  const [deactivating, setDeactivating] = useState<TreeCategory | null>(null);
  const [activation, dispatchActivation, activationPending] = useActionState(setCategoryActiveAction, NOT_SENT);
  // A reativação aceita mostra o aviso temporário até ele sumir; a desativação já se vê no selo da linha.
  const [dismissed, setDismissed] = useState<CategoryCommandResult | null>(null);
  const notice =
    activation.saved?.active && dismissed !== activation
      ? `${activation.saved.name} foi reativada e voltou às escolhas dos lançamentos.`
      : null;
  const dismissNotice = useCallback(() => {
    setDismissed(activation);
  }, [activation]);
  const searching = params.q.trim() !== '';
  const adjective = NATURE_TEXT[params.nature].adjective;

  function setActive(category: TreeCategory, active: boolean) {
    startTransition(() => {
      dispatchActivation({ id: category.id, active, version: category.version });
    });
  }

  function row(category: TreeCategory, parent: TreeCategory | null, children: number, open: boolean) {
    const collapsible = !searching && children > 0;
    const level = parent === null ? 1 : 2;
    const path = pathOf(category, parent);
    return (
      <div
        key={category.id}
        role="row"
        aria-level={level}
        className="flex min-h-10 items-center gap-3 border-t border-hairline px-4"
      >
        <span role="gridcell" className="flex min-w-0 flex-1 items-center gap-2">
          {level === 2 && (
            <span aria-hidden="true" className="ml-3 w-6 flex-none self-stretch border-l border-hairline" />
          )}
          {collapsible ? (
            <button
              type="button"
              aria-label={`${open ? 'Recolher' : 'Abrir'} ${category.name}`}
              aria-expanded={open}
              onClick={() => {
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (open) next.add(category.id);
                  else next.delete(category.id);
                  return next;
                });
              }}
              className={`inline-flex size-6 ${GHOST_ICON_BUTTON}`}
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className={open ? 'rotate-90' : ''} />
            </button>
          ) : (
            <span aria-hidden="true" className="w-6 flex-none" />
          )}
          {renaming === category.id ? (
            <RenameField
              category={category}
              path={path}
              onDone={() => {
                setRenaming(null);
              }}
            />
          ) : (
            <>
              <CategoryName category={category} q={params.q} level={level} />
              {!category.matched && <span className="flex-none text-body-sm text-mute">categoria pai</span>}
              {!category.active && <InactiveBadge />}
            </>
          )}
        </span>
        <span role="gridcell" className="flex-none" />
        <span role="gridcell" className="flex flex-none justify-end gap-1">
          {level === 1 && category.active && <NewSubcategory parent={category} nature={category.nature} />}
          <RowMenu
            category={category}
            path={path}
            pending={activationPending}
            commands={{
              rename: () => {
                setRenaming(category.id);
              },
              move: () => {
                setMoving({ category, parent, hasChildren: children > 0 });
              },
              deactivate: () => {
                setDeactivating(category);
              },
              reactivate: () => {
                setActive(category, true);
              },
            }}
          />
        </span>
      </div>
    );
  }

  return (
    <>
      {activation.message !== null && (
        <div className="px-4 pt-4">
          <ErrorNotice>{activation.message}</ErrorNotice>
        </div>
      )}
      <div
        id="category-tree"
        role="treegrid"
        aria-label={`Categorias de ${adjective}`}
        aria-describedby={tabId(params.nature)}
        className="flex flex-col py-1"
      >
        <div role="row" className="flex items-center gap-3 px-4 py-1 text-label text-mute">
          <span role="columnheader" className="flex-1">
            Categoria
          </span>
          {/* O total do mês por categoria entra com os lançamentos; até lá, a coluna fica vazia. */}
          <span role="columnheader" className="flex-none text-right whitespace-nowrap">
            {month}
          </span>
          <span role="columnheader" className="w-16">
            <span className="sr-only">Ações</span>
          </span>
        </div>
        {items.map((item) => {
          // Na busca, a árvore fica toda aberta, sem recolher.
          const open = searching || !collapsed.has(item.id);
          return [
            row(item, null, item.children.length, open),
            ...(open ? item.children.map((child) => row(child, item, 0, false)) : []),
          ];
        })}
      </div>
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-2 border-t border-hairline px-4 pt-8 pb-10 text-center">
          {searching ? (
            <>
              <p className="text-ink">
                Nenhuma categoria de {adjective} com “{params.q.trim()}”.
              </p>
              <p className="text-body-sm text-mute">
                A busca procura no nome das categorias da aba aberta
                {params.showInactive ? ', também nas desativadas' : ''}.
              </p>
              <button
                type="button"
                onClick={() => {
                  router.replace(categoriesHref({ ...params, q: '', page: 1 }), { scroll: false });
                }}
                className={SECONDARY_BUTTON}
              >
                Limpar a busca
              </button>
            </>
          ) : (
            <p className="text-ink">Nenhuma categoria de {adjective}.</p>
          )}
        </div>
      )}
      <FormDialog
        open={moving !== null}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        title={`Mover ${moving?.category.name ?? ''} para…`}
        description={`${moving?.parent ? `Hoje em ${moving.parent.name}.` : 'Hoje no primeiro nível.'} Os lançamentos dela vão junto.`}
      >
        {moving !== null && (
          <MoveForm
            category={moving.category}
            parent={moving.parent}
            hasChildren={moving.hasChildren}
            onSaved={() => {
              setMoving(null);
            }}
          />
        )}
      </FormDialog>
      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
        title={`Desativar a categoria ${deactivating?.name ?? ''}?`}
        description={
          deactivating?.parentId === null
            ? 'Ela e as subcategorias dela somem das escolhas dos lançamentos novos e continuam nos lançamentos que já têm, e nos números. Dá para reativá-las depois.'
            : 'Ela some das escolhas dos lançamentos novos e continua nos lançamentos que já tem, e nos números. Dá para reativá-la depois.'
        }
        confirmLabel="Desativar categoria"
        onConfirm={() => {
          if (deactivating !== null) setActive(deactivating, false);
        }}
      />
      <TemporaryNotice text={notice} onGone={dismissNotice} />
    </>
  );
}
