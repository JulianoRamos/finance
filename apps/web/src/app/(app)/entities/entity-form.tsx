'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { Entity, EntityType } from '@/api/entities';

import { ErrorNotice, FieldError, SubmitButton, TextField } from '../../_access/fields';
import { SECONDARY_BUTTON } from '../../_shell/buttons';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import { createEntityAction, type EntityFormState, updateEntityAction } from './actions';
import { formatTaxId, TYPE_NAMES } from './tax-id-format';

const CHOICE = `flex cursor-pointer items-start gap-3 rounded-md border border-hairline p-3 hover:border-hairline-strong has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;
const CONTROL = 'mt-1 size-4 flex-none accent-accent outline-none';

/**
 * Os textos do nome e do documento, que seguem o tipo marcado e são neutros antes da escolha. Sem
 * tipo, não há um só formato de documento para mostrar.
 */
const TYPE_TEXT: Readonly<
  Record<EntityType | 'none', { namePlaceholder: string; taxIdLabel: string; taxIdPlaceholder?: string }>
> = {
  individual: {
    namePlaceholder: 'Como a pessoa é chamada no dia a dia',
    taxIdLabel: 'CPF (opcional)',
    taxIdPlaceholder: '000.000.000-00',
  },
  company: {
    namePlaceholder: 'Como a empresa é chamada no dia a dia',
    taxIdLabel: 'CNPJ (opcional)',
    taxIdPlaceholder: '00.000.000/0000-00',
  },
  none: { namePlaceholder: 'Como ela é chamada no dia a dia', taxIdLabel: 'CPF ou CNPJ (opcional)' },
};

/** Uma escolha do tipo, um rádio com o nome e a descrição, em `body`, que tem contraste também marcada. */
function TypeChoice({
  type,
  defaultChecked,
  onChoose,
  description,
}: Readonly<{ type: EntityType; defaultChecked: boolean; onChoose: (type: EntityType) => void; description: string }>) {
  return (
    <label className={CHOICE}>
      <input
        type="radio"
        name="type"
        value={type}
        defaultChecked={defaultChecked}
        onChange={() => {
          onChoose(type);
        }}
        className={CONTROL}
      />
      <span className="flex flex-col gap-1">
        <span className="text-label text-ink">{TYPE_NAMES[type]}</span>
        <span className="text-body-sm text-body">{description}</span>
      </span>
    </label>
  );
}

/**
 * O formulário de uma entidade, no lugar do detalhe: na criação, o tipo, o nome, o documento e as
 * operações; na edição, o nome e o documento, com o tipo fixo (regra 6.2). Depois de uma recusa, os
 * campos voltam ao que foi enviado, que a ação devolve.
 */
export function EntityForm({ entity }: Readonly<{ entity?: Entity }>) {
  const [state, action] = useActionState<EntityFormState, FormData>(
    entity ? updateEntityAction : createEntityAction,
    INITIAL_FORM_STATE,
  );
  const values = state.values ?? {
    type: entity?.type ?? null,
    name: entity?.name ?? '',
    taxId: entity?.taxId ? formatTaxId(entity.type, entity.taxId) : '',
    clinic: false,
  };
  // O tipo marcado muda o rótulo do documento e mostra as operações, antes do envio.
  const [type, setType] = useState(values.type);
  const text = TYPE_TEXT[type ?? 'none'];
  const titleId = entity ? 'edit-title' : 'new-title';

  return (
    <form
      action={action}
      aria-labelledby={titleId}
      className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-heading-md text-ink">
          {entity ? 'Editar dados' : 'Nova entidade'}
        </h2>
        <p className="wrap-anywhere">
          {entity
            ? `${entity.name} · ${TYPE_NAMES[entity.type].toLowerCase()}. O tipo não muda depois de criado.`
            : 'Ela aparece no seletor de contexto para quem tiver permissão nela.'}
        </p>
      </div>
      {state.message && (
        <ErrorNotice>
          <span className="flex flex-wrap items-center gap-3">
            {state.message}
            {state.conflict && entity && (
              // Um link comum, e não o do Next, para a entidade ser pedida de novo ao servidor.
              <a href={`/entities/${entity.id}/edit`} className={SECONDARY_BUTTON}>
                Recarregar a entidade
              </a>
            )}
          </span>
        </ErrorNotice>
      )}
      {entity ? (
        <>
          <input type="hidden" name="id" value={entity.id} />
          <input type="hidden" name="version" value={entity.version} />
          <input type="hidden" name="type" value={entity.type} />
        </>
      ) : (
        <fieldset aria-describedby={state.fields.type ? 'type-error' : undefined} className="flex flex-col gap-2">
          <legend className="mb-2 text-label text-ink">Tipo</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <TypeChoice
              type="individual"
              defaultChecked={values.type === 'individual'}
              onChoose={setType}
              description="Uma pessoa da família"
            />
            <TypeChoice
              type="company"
              defaultChecked={values.type === 'company'}
              onChoose={setType}
              description="Uma empresa, como a clínica"
            />
          </div>
          <FieldError id="type-error" error={state.fields.type} />
        </fieldset>
      )}
      <TextField
        id="entity-name"
        name="name"
        label="Nome"
        autoComplete="off"
        size="app"
        required={false}
        defaultValue={values.name}
        error={state.fields.name}
        placeholder={text.namePlaceholder}
      />
      <TextField
        id="entity-tax-id"
        name="taxId"
        label={text.taxIdLabel}
        autoComplete="off"
        size="app"
        required={false}
        defaultValue={values.taxId}
        help="Não se repete entre entidades."
        error={state.fields.taxId}
        placeholder={text.taxIdPlaceholder}
        // O CNPJ alfanumérico tem letras: só o CPF pede o teclado numérico.
        inputMode={type === 'individual' ? 'numeric' : 'text'}
      />
      {!entity && type === 'company' && (
        <fieldset
          aria-describedby={state.fields.operations ? 'operations-error' : undefined}
          className="flex flex-col gap-2"
        >
          <legend className="mb-2 text-label text-ink">Operações (opcional)</legend>
          <label className={CHOICE}>
            <input type="checkbox" name="clinic" defaultChecked={values.clinic} className={CONTROL} />
            <span className="flex flex-col gap-1">
              <span className="text-label text-ink">Clínica</span>
              <span className="text-body-sm text-body">
                Clientes, procedimentos, atendimentos, pacotes, estoque e compras.
              </span>
            </span>
          </label>
          <p className="text-body-sm text-mute">
            Toda empresa já tem o financeiro. Uma operação liga as funções de um segmento, e dá para ligar ou desligar
            depois.
          </p>
          <FieldError id="operations-error" error={state.fields.operations} />
        </fieldset>
      )}
      {entity && <p className="text-body-sm text-mute">A alteração entra no histórico, com o antes e o depois.</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
        <Link href={entity ? `/entities/${entity.id}` : '/entities'} className={SECONDARY_BUTTON}>
          Cancelar
        </Link>
        <SubmitButton size="app">{entity ? 'Salvar alterações' : 'Criar entidade'}</SubmitButton>
      </div>
    </form>
  );
}
