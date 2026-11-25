'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { AccountChoice } from '@/api/accounts';
import type { CategoryChoice } from '@/api/categories';

import { FOCUS_RING } from '../../_access/access-screen';
import {
  ControlField,
  DateField,
  describedBy,
  ErrorNotice,
  FieldError,
  inputClass,
  SubmitButton,
  TextField,
} from '../../_access/fields';
import { SECONDARY_BUTTON } from '../../_shell/buttons';
import { CHOICE, CHOICE_CONTROL } from '../../_shell/choice';
import { formatCalendarDate } from '../../_shell/format';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import { formatMoney, formatMoneyInput, parseMoneyInput } from '../../_shell/money';
import { createEntryAction, type EntryFormState, type EntryFormValues } from './actions';
import { categoryPath } from '../../_shell/category-text';
import {
  dueDateLabel,
  type EntryPurpose,
  type EntryType,
  OCCURRED_ON_LABELS,
  PURPOSE_NAMES,
  TYPE_NAMES,
} from './entry-text';
import { type PreviewInstallment, previewInstallments } from './installment-preview';

/** Uma pessoa física que pode ser a dona do lançamento. */
export interface IndividualOption {
  readonly id: string;
  readonly name: string;
}

/** Quantas parcelas a prévia mostra inteira; acima disso, as três primeiras, o resumo do meio e a última. */
const PREVIEW_ALL_UP_TO = 4;

/** Uma escolha em rádio, num grupo com a legenda e o erro. */
function RadioGroup<T extends string>({
  id,
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: Readonly<{
  id: string;
  legend: string;
  name: string;
  options: readonly { readonly value: T; readonly label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | undefined;
}>) {
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-ink">{legend}</legend>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => (
          <label key={option.value} className={`${CHOICE} items-center py-2`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className={`${CHOICE_CONTROL} mt-0`}
            />
            <span className="text-label text-ink">{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </fieldset>
  );
}

/** Os valores do formulário antes do primeiro envio. */
function initialValues(individuals: readonly IndividualOption[]): EntryFormValues {
  const [only] = individuals;
  return {
    type: 'expense',
    entityId: individuals.length === 1 && only ? only.id : '',
    description: '',
    totalAmount: '',
    occurredOn: '',
    categoryId: '',
    purpose: null,
    installments: false,
    installmentCount: '2',
    firstDueDate: '',
    accountId: '',
  };
}

/** O ordinal da parcela: "1ª parcela". */
function ordinal(number: number): string {
  return `${String(number)}ª parcela`;
}

/**
 * A prévia das parcelas do parcelado, calculada na web pela regra da api, só para mostrar: até quatro,
 * todas; acima disso, as três primeiras, quantas faltam e a última, como o protótipo.
 */
function Preview({ installments, total }: Readonly<{ installments: readonly PreviewInstallment[]; total: string }>) {
  const last = installments.at(-1);
  const collapsed = installments.length > PREVIEW_ALL_UP_TO;
  const shown = collapsed ? installments.slice(0, PREVIEW_ALL_UP_TO - 1) : installments;
  const hidden = installments.length - shown.length - 1;
  const item = (installment: PreviewInstallment) => (
    <li key={installment.number} className="grid grid-cols-3 items-center gap-3 py-1 tabular-nums">
      <span className="text-ink">{ordinal(installment.number)}</span>
      <span className="text-body">{formatCalendarDate(installment.dueDate)}</span>
      <span className="text-right text-ink">{formatMoney(installment.amount)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-2 rounded-md bg-canvas p-4">
      <span className="text-label text-ink">As parcelas que serão criadas</span>
      <ol aria-label="Prévia das parcelas" className="flex flex-col">
        {shown.map(item)}
        {collapsed && last && (
          <>
            <li className="py-1 text-body-sm text-mute">
              e mais {hidden} parcelas de {formatMoney(last.amount)}, uma por mês
            </li>
            {item(last)}
          </>
        )}
      </ol>
      <p className="text-body-sm text-mute">
        {installments.length} parcelas mensais somando {formatMoney(total)}. A diferença dos centavos fica na primeira.
      </p>
    </div>
  );
}

/**
 * O formulário do novo lançamento, no lugar do detalhe (design-system.md, seção 4.1): o tipo, a pessoa
 * física, a descrição, o total, a data do fato, com os atalhos "Hoje" e "Ontem", a categoria da natureza do
 * tipo, com o caminho do pai, a finalidade, na despesa, e o pagamento, à vista ou parcelado, com a conta
 * da pessoa e a prévia das parcelas. Depois de uma recusa, os campos voltam ao que foi enviado.
 */
export function EntryForm({
  individuals,
  accounts,
  categories,
  today,
  yesterday,
}: Readonly<{
  individuals: readonly IndividualOption[];
  accounts: readonly AccountChoice[];
  categories: Readonly<Record<EntryType, readonly CategoryChoice[]>>;
  today: string;
  yesterday: string;
}>) {
  const [state, action] = useActionState<EntryFormState, FormData>(createEntryAction, INITIAL_FORM_STATE);
  const sent = state.values ?? initialValues(individuals);
  // As escolhas que mudam o resto do formulário ficam no estado, a partir do que foi enviado.
  const [type, setType] = useState<EntryType>(sent.type);
  const [entityId, setEntityId] = useState(sent.entityId);
  const [categoryId, setCategoryId] = useState(sent.categoryId);
  const [purpose, setPurpose] = useState<EntryPurpose | null>(sent.purpose);
  const [installments, setInstallments] = useState(sent.installments);
  const [total, setTotal] = useState(sent.totalAmount);
  const [count, setCount] = useState(sent.installmentCount);
  const [occurredOn, setOccurredOn] = useState(sent.occurredOn);
  const [firstDueDate, setFirstDueDate] = useState(sent.firstDueDate);
  const [accountId, setAccountId] = useState(sent.accountId);
  const fields = state.fields;

  const ownAccounts = accounts.filter((account) => account.entityId === entityId);
  const totalDecimal = parseMoneyInput(total);
  const preview =
    installments && totalDecimal !== null && !totalDecimal.startsWith('-') && firstDueDate !== ''
      ? previewInstallments(totalDecimal, Number(count), firstDueDate)
      : [];

  return (
    <form
      action={action}
      aria-labelledby="new-title"
      className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="new-title" className="text-heading-md text-ink">
          Novo lançamento
        </h2>
        <p>Uma receita ou uma despesa de uma pessoa física, única ou em parcelas.</p>
      </div>
      {state.message && <ErrorNotice>{state.message}</ErrorNotice>}
      <RadioGroup<EntryType>
        id="new-type"
        legend="Tipo"
        name="type"
        options={[
          { value: 'expense', label: TYPE_NAMES.expense },
          { value: 'revenue', label: TYPE_NAMES.revenue },
        ]}
        value={type}
        onChange={(next) => {
          setType(next);
          // A categoria é da natureza do tipo, e a receita não tem finalidade.
          setCategoryId('');
          setPurpose(null);
        }}
        error={fields.type}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <ControlField id="new-entity" label="Entidade" error={fields.entityId}>
          <select
            id="new-entity"
            name="entityId"
            value={entityId}
            onChange={(event) => {
              setEntityId(event.target.value);
              // A conta é da entidade escolhida.
              setAccountId('');
            }}
            className={inputClass('app')}
            {...describedBy('new-entity', fields.entityId)}
          >
            {individuals.length > 1 && <option value="">Selecione</option>}
            {individuals.map((individual) => (
              <option key={individual.id} value={individual.id}>
                {individual.name}
              </option>
            ))}
          </select>
        </ControlField>
        <TextField
          id="new-description"
          name="description"
          label="Descrição"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={sent.description}
          error={fields.description}
          placeholder="Ex.: Sofá da sala"
        />
        <ControlField id="new-total" label="Valor total (R$)" error={fields.totalAmount}>
          <input
            id="new-total"
            name="totalAmount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={total}
            onChange={(event) => {
              setTotal(event.target.value);
            }}
            onBlur={() => {
              // Formata ao sair do campo; o que não é um valor fica como foi digitado, para a recusa.
              if (totalDecimal !== null) setTotal(formatMoneyInput(totalDecimal));
            }}
            className={`${inputClass('app')} text-right tabular-nums`}
            {...describedBy('new-total', fields.totalAmount)}
          />
        </ControlField>
        <DateField
          id="new-occurred-on"
          name="occurredOn"
          label={OCCURRED_ON_LABELS[type]}
          autoComplete="off"
          size="app"
          required={false}
          value={occurredOn}
          onValueChange={setOccurredOn}
          error={fields.occurredOn}
          after={
            <span className="ml-3 flex flex-none items-center gap-3">
              {[
                { label: 'Hoje', date: today },
                { label: 'Ontem', date: yesterday },
              ].map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => {
                    setOccurredOn(shortcut.date);
                  }}
                  className={`rounded-sm text-label text-link hover:underline ${FOCUS_RING}`}
                >
                  {shortcut.label}
                </button>
              ))}
            </span>
          }
        />
        <ControlField
          id="new-category"
          label="Categoria"
          help={`Só as categorias de ${type === 'expense' ? 'despesa' : 'receita'}.`}
          error={fields.categoryId}
        >
          <select
            id="new-category"
            name="categoryId"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
            }}
            className={inputClass('app')}
            {...describedBy('new-category', fields.categoryId, true)}
          >
            <option value="">Selecione</option>
            {categories[type].map((category) => (
              <option key={category.id} value={category.id}>
                {categoryPath(category.name, category.parentName)}
              </option>
            ))}
          </select>
        </ControlField>
        {type === 'expense' && (
          <RadioGroup<EntryPurpose>
            id="new-purpose"
            legend="Finalidade"
            name="purpose"
            options={[
              { value: 'personal', label: PURPOSE_NAMES.personal },
              { value: 'household', label: PURPOSE_NAMES.household },
            ]}
            value={purpose}
            onChange={setPurpose}
            error={fields.purpose}
          />
        )}
      </div>
      <div className="flex flex-col gap-6 border-t border-hairline pt-6">
        <RadioGroup<'single' | 'installments'>
          id="new-payment"
          legend="Pagamento"
          name="payment"
          options={[
            { value: 'single', label: 'À vista' },
            { value: 'installments', label: 'Parcelado' },
          ]}
          value={installments ? 'installments' : 'single'}
          onChange={(next) => {
            setInstallments(next === 'installments');
          }}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {installments && (
            <ControlField id="new-installment-count" label="Número de parcelas" error={fields.installmentCount}>
              <input
                id="new-installment-count"
                name="installmentCount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={count}
                onChange={(event) => {
                  setCount(event.target.value);
                }}
                className={`${inputClass('app')} text-right tabular-nums`}
                {...describedBy('new-installment-count', fields.installmentCount)}
              />
            </ControlField>
          )}
          <DateField
            id="new-first-due-date"
            name="firstDueDate"
            label={dueDateLabel(type, installments)}
            autoComplete="off"
            size="app"
            required={false}
            value={firstDueDate}
            onValueChange={setFirstDueDate}
            error={fields.firstDueDate}
          />
          <ControlField id="new-account" label="Conta" error={fields.accountId}>
            <select
              id="new-account"
              name="accountId"
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
              }}
              className={inputClass('app')}
              {...describedBy('new-account', fields.accountId)}
            >
              <option value="">Selecione</option>
              {ownAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </ControlField>
        </div>
        {preview.length > 0 && totalDecimal !== null && <Preview installments={preview} total={totalDecimal} />}
      </div>
      {/* No celular, as ações ficam fixas no rodapé, acima da área segura (design-system.md, seção 6). */}
      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-hairline bg-surface px-4 pt-3 pb-safe md:static md:mx-0 md:flex md:flex-wrap md:justify-end md:px-0 md:pt-4 md:pb-0">
        <Link href="/entries" className={SECONDARY_BUTTON}>
          Cancelar
        </Link>
        <SubmitButton size="app">Registrar lançamento</SubmitButton>
      </div>
    </form>
  );
}
