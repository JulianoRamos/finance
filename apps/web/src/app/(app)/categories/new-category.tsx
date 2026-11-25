'use client';

import { Plus } from 'lucide-react';
import { type ReactElement, useActionState, useEffect, useState } from 'react';

import { ErrorNotice, FieldError, SubmitButton, TextField } from '../../_access/fields';
import { GHOST_ICON_BUTTON, PRIMARY_BUTTON } from '../../_shell/buttons';
import { FormDialog, FormDialogCancel } from '../../_shell/form-dialog';
import { UNSAVED_FORM_STATE } from '../../_shell/form-state';
import { createCategoryAction } from './actions';
import { type Nature, NATURE_TEXT, NATURES } from '../../_shell/category-text';

/** Uma opção da natureza, como um botão de alternância, marcada em `accent-soft`. */
const NATURE_OPTION = `flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-hairline-strong bg-surface text-label text-ink has-checked:border-accent has-checked:bg-accent-soft md:h-9 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;

/**
 * O formulário da categoria nova: a natureza e o nome na de primeiro nível, e só o nome na subcategoria,
 * que tem a natureza do pai. Ele só existe com o diálogo aberto, então cada abertura começa do zero.
 */
function CategoryForm({
  parentId,
  nature,
  onSaved,
}: Readonly<{ parentId: string | null; nature: Nature; onSaved: () => void }>) {
  const [state, action] = useActionState(createCategoryAction, UNSAVED_FORM_STATE);
  // O envio aceito fecha o diálogo; a árvore já chega atualizada pela revalidação.
  useEffect(() => {
    if (state.saved) onSaved();
  }, [state.saved, onSaved]);
  const values = state.values;
  return (
    <form action={action} className="flex flex-col gap-4">
      {parentId !== null && <input type="hidden" name="parentId" value={parentId} />}
      {parentId === null && (
        <fieldset
          aria-describedby={state.fields.nature ? 'category-nature-error' : 'category-nature-help'}
          className="flex flex-col gap-1"
        >
          <legend className="mb-1 text-label text-ink">Natureza</legend>
          <div className="flex gap-2">
            {NATURES.map((option) => (
              <label key={option} className={NATURE_OPTION}>
                <input
                  type="radio"
                  name="nature"
                  value={option}
                  defaultChecked={(values?.nature ?? nature) === option}
                  className="size-4 accent-ink"
                />
                {NATURE_TEXT[option].label}
              </label>
            ))}
          </div>
          <p id="category-nature-help" className="text-body-sm text-mute">
            Vem marcada a da aba aberta. A natureza não muda depois.
          </p>
          <FieldError id="category-nature-error" error={state.fields.nature} />
        </fieldset>
      )}
      <TextField
        id="category-name"
        name="name"
        label="Nome"
        autoComplete="off"
        size="app"
        defaultValue={values?.name ?? ''}
        error={state.fields.name}
      />
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <FormDialogCancel />
        <SubmitButton size="app">{parentId === null ? 'Criar categoria' : 'Criar subcategoria'}</SubmitButton>
      </div>
    </form>
  );
}

/** O diálogo da categoria nova, aberto pelo botão dado (design-system.md, seção 4.5). */
function NewCategoryDialog({
  parent,
  nature,
  trigger,
}: Readonly<{ parent: { id: string; name: string } | null; nature: Nature; trigger: ReactElement }>) {
  const [open, setOpen] = useState(false);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={parent === null ? 'Nova categoria' : `Nova subcategoria em ${parent.name}`}
      description={
        parent === null
          ? 'No primeiro nível da árvore. Para pôr dentro de outra, use o “+” da linha dela.'
          : `Ela é de ${NATURE_TEXT[nature].adjective}, como a categoria pai.`
      }
      trigger={trigger}
    >
      <CategoryForm
        parentId={parent?.id ?? null}
        nature={nature}
        onSaved={() => {
          setOpen(false);
        }}
      />
    </FormDialog>
  );
}

/** O "Nova categoria" do cabeçalho, que cria no primeiro nível, com a natureza da aba aberta marcada. */
export function NewCategory({ nature }: Readonly<{ nature: Nature }>) {
  return (
    <NewCategoryDialog
      parent={null}
      nature={nature}
      trigger={
        <button type="button" className={PRIMARY_BUTTON}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Nova categoria
        </button>
      }
    />
  );
}

/** O "+" da linha de uma categoria de primeiro nível, que cria uma subcategoria nela. */
export function NewSubcategory({ parent, nature }: Readonly<{ parent: { id: string; name: string }; nature: Nature }>) {
  const label = `Nova subcategoria em ${parent.name}`;
  return (
    <NewCategoryDialog
      parent={parent}
      nature={nature}
      trigger={
        <button type="button" aria-label={label} className={`inline-flex size-7 ${GHOST_ICON_BUTTON}`}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      }
    />
  );
}
