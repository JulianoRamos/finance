'use client';

import { useActionState, useEffect, useState } from 'react';

import { DateField, ErrorNotice, FieldError, SubmitButton, TextField } from '../../../_access/fields';
import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { UNSAVED_FORM_STATE } from '../../../_shell/form-state';
import type { ListPage } from '../../../_shell/list-page';
import { Pagination, useSearchedPages } from '../../../_shell/pagination';
import { SEARCH_ABOVE, SearchBox } from '../../../_shell/search-box';
import { createEquityStakeAction, type EquityStakeFormState, searchEntityOptionsAction } from '../actions';
import { EntityBadge } from '../entity-badge';
import type { EntityOption } from '../entity-option';
import { SUBFORM } from './equity-stake-view';

const ROW = 'flex items-center gap-3 rounded-sm border border-hairline bg-surface px-3 py-2';
const CONTROL = 'size-4 flex-none accent-accent';

/** O sócio escolhido: o id, que vai para a api, e o nome, que a recusa da soma cita. */
type Holder = Pick<EntityOption, 'id' | 'name'>;

/**
 * A escolha do sócio, de escolha única: as entidades ativas vêm da api de 10 em 10; com mais de 10, a
 * busca no topo e a Paginação no rodapé (design-system.md, seção 4.3). A própria empresa aparece
 * desabilitada, para a página e o total serem os da api. O escolhido fica num estado, que sobrevive à
 * busca e à página, e vai no envio pelos campos ocultos.
 */
function HolderChoice({
  companyId,
  options,
  holder,
  onChoose,
  error,
}: Readonly<{
  companyId: string;
  options: ListPage<EntityOption>;
  holder: Holder | null;
  onChoose: (holder: Holder) => void;
  error: string | undefined;
}>) {
  const { query, shown, failed, search, goTo } = useSearchedPages(options, searchEntityOptionsAction);
  const paged = options.total > SEARCH_ABOVE;
  const hidden = holder !== null && !shown.items.some((option) => option.id === holder.id);

  return (
    <fieldset aria-describedby={error ? 'holder-error' : undefined} className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-ink">Sócio</legend>
      {holder && (
        <>
          <input type="hidden" name="holderId" value={holder.id} />
          <input type="hidden" name="holderName" value={holder.name} />
        </>
      )}
      {paged && <SearchBox id="holder-search" label="Buscar entidade" query={query} onSearch={search} />}
      {hidden && <p className="text-body-sm text-mute">Escolhido: {holder.name}</p>}
      {failed && <ErrorNotice>Não foi possível carregar as entidades. Tente de novo.</ErrorNotice>}
      {options.total === 0 && <p className="text-body-sm text-mute">Nenhuma entidade ativa para escolher.</p>}
      {options.total > 0 && shown.total === 0 && <p className="text-body-sm text-mute">Nenhuma entidade encontrada.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {shown.items.map((option) => {
          const own = option.id === companyId;
          return (
            <label key={option.id} className={`${ROW} ${own ? 'text-mute' : 'text-ink'}`}>
              <input
                type="radio"
                name="holderChoice"
                checked={!own && holder?.id === option.id}
                disabled={own}
                onChange={() => {
                  onChoose({ id: option.id, name: option.name });
                }}
                className={CONTROL}
              />
              <span className="min-w-0 wrap-anywhere">{option.name}</span>
              {own ? (
                <span className="ml-auto text-body-sm">Esta empresa</span>
              ) : (
                <EntityBadge entity={option} className="ml-auto" />
              )}
            </label>
          );
        })}
      </div>
      {paged && <Pagination page={shown.page} pageSize={shown.pageSize} total={shown.total} onPage={goTo} />}
      <FieldError id="holder-error" error={error} />
    </fieldset>
  );
}

/**
 * O formulário de registrar uma participação na empresa, dentro da seção, como no protótipo: o sócio, a
 * fração em percentual, o início e o fim opcional. Depois de uma recusa, os campos voltam ao que foi
 * enviado.
 */
export function EquityStakeForm({
  companyId,
  holders,
  onClose,
}: Readonly<{ companyId: string; holders: ListPage<EntityOption>; onClose: () => void }>) {
  const [state, action] = useActionState<EquityStakeFormState, FormData>(createEquityStakeAction, UNSAVED_FORM_STATE);
  // O envio aceito fecha o formulário; a tabela já chega atualizada pela revalidação.
  useEffect(() => {
    if (state.saved) onClose();
  }, [state.saved, onClose]);
  const [holder, setHolder] = useState<Holder | null>(null);

  return (
    <form action={action} aria-label="Registrar participação" className={SUBFORM}>
      <input type="hidden" name="companyId" value={companyId} />
      <HolderChoice
        companyId={companyId}
        options={holders}
        holder={holder}
        onChoose={setHolder}
        error={state.fields.holderId}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <TextField
          id="equity-stake-percent"
          name="percent"
          label="Fração (%)"
          autoComplete="off"
          size="app"
          inputMode="decimal"
          defaultValue={state.values?.percent ?? ''}
          error={state.fields.fraction}
        />
        <DateField
          id="equity-stake-start"
          name="startDate"
          label="Início"
          autoComplete="off"
          size="app"
          defaultValue={state.values?.startDate ?? ''}
          error={state.fields.startDate}
        />
        <DateField
          id="equity-stake-end"
          name="endDate"
          label="Fim (opcional)"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={state.values?.endDate ?? ''}
          error={state.fields.endDate}
        />
      </div>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Cancelar
        </button>
        <SubmitButton size="app">Registrar</SubmitButton>
      </div>
    </form>
  );
}
