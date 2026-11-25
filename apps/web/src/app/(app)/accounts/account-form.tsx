'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { Account, AccountType, Institution } from '@/api/accounts';

import {
  ControlField,
  DateField,
  describedBy,
  FieldError,
  ErrorNotice,
  inputClass,
  SubmitButton,
  TextField,
} from '../../_access/fields';
import { ACCOUNT_TYPE_NAMES, INSTITUTION_NAMES } from '../../_shell/account-text';
import { SECONDARY_BUTTON } from '../../_shell/buttons';
import { CHOICE, CHOICE_CONTROL } from '../../_shell/choice';
import { INITIAL_FORM_STATE } from '../../_shell/form-state';
import { formatMoneyInput, parseMoneyInput } from '../../_shell/money';
import { type AccountFormState, type AccountFormValues, createAccountAction, updateAccountAction } from './actions';

/** A descrição de cada tipo, abaixo do nome, na escolha do tipo. */
const TYPE_DESCRIPTIONS: Readonly<Record<AccountType, string>> = {
  checking: 'Conta bancária do dia a dia.',
  payment: 'Carteira digital, como a do Mercado Pago.',
  cash: 'O dinheiro na carteira ou no cofre.',
};

/** Uma entidade que pode ser a dona da conta nova. */
export interface OwnerOption {
  readonly id: string;
  readonly name: string;
}

/** Os valores do formulário antes do primeiro envio: os da conta, na edição, ou os vazios. */
function initialValues(account: Account | undefined, owners: readonly OwnerOption[]): AccountFormValues {
  if (!account) {
    const [only] = owners;
    return {
      entityId: owners.length === 1 && only ? only.id : '',
      name: '',
      type: null,
      institution: 'nubank',
      isReserve: false,
      openingBalance: '',
      openingBalanceDate: '',
    };
  }
  return {
    entityId: account.entityId,
    name: account.name,
    type: account.type,
    institution: account.institution,
    isReserve: account.isReserve,
    openingBalance: formatMoneyInput(account.openingBalance),
    openingBalanceDate: account.openingBalanceDate,
  };
}

/**
 * O formulário de uma conta, no lugar do detalhe: na criação, a entidade dona, entre as ativas do contexto;
 * na edição, a dona só como texto, porque não muda (LLD, seção 4.5). Depois de uma recusa, os campos voltam
 * ao que foi enviado, que a ação devolve.
 */
export function AccountForm({
  account,
  owners = [],
}: Readonly<{ account?: Account; owners?: readonly OwnerOption[] }>) {
  const [state, action] = useActionState<AccountFormState, FormData>(
    account ? updateAccountAction : createAccountAction,
    INITIAL_FORM_STATE,
  );
  const values = state.values ?? initialValues(account, owners);
  const titleId = account ? 'edit-title' : 'new-title';
  const prefix = account ? 'edit' : 'new';

  return (
    <form
      action={action}
      aria-labelledby={titleId}
      className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-heading-md wrap-anywhere text-ink">
          {account ? `Editar ${account.name}` : 'Nova conta'}
        </h2>
        <p>
          {account
            ? 'O saldo é recalculado a partir do saldo inicial.'
            : 'O saldo da conta é o saldo inicial mais as movimentações a partir da data dele.'}
        </p>
      </div>
      {state.message && (
        <ErrorNotice>
          <span className="flex flex-wrap items-center gap-3">
            {state.message}
            {state.conflict && account && (
              // Um link comum, e não o do Next, para a conta ser pedida de novo ao servidor.
              <a href={`/accounts/${account.id}/edit`} className={SECONDARY_BUTTON}>
                Recarregar a conta
              </a>
            )}
          </span>
        </ErrorNotice>
      )}
      {account ? (
        <>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="version" value={account.version} />
          <input type="hidden" name="entityId" value={account.entityId} />
          <div className="flex flex-col gap-1">
            <span className="text-label text-ink">Entidade</span>
            <span className="wrap-anywhere text-ink">{account.entityName}</span>
            <span className="text-body-sm text-mute">A conta não muda de dono.</span>
          </div>
        </>
      ) : (
        <ControlField
          id={`${prefix}-entity`}
          label="Entidade"
          help="A pessoa física ou a empresa dona da conta."
          error={state.fields.entityId}
        >
          <select
            id={`${prefix}-entity`}
            // O React devolve o select ao valor com que ele nasceu ao limpar o formulário depois do envio: a
            // chave o recria com o valor enviado, depois de uma recusa.
            key={values.entityId}
            name="entityId"
            defaultValue={values.entityId}
            className={inputClass('app')}
            {...describedBy(`${prefix}-entity`, state.fields.entityId, true)}
          >
            <option value="">Selecione</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </ControlField>
      )}
      <TextField
        id={`${prefix}-name`}
        name="name"
        label="Nome"
        autoComplete="off"
        size="app"
        required={false}
        defaultValue={values.name}
        error={state.fields.name}
        placeholder="Ex.: Nubank, Carteira"
      />
      <fieldset
        aria-describedby={state.fields.type ? `${prefix}-type-error` : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-2 text-label text-ink">Tipo</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(ACCOUNT_TYPE_NAMES) as AccountType[]).map((type) => (
            <label key={type} className={CHOICE}>
              <input
                type="radio"
                name="type"
                value={type}
                defaultChecked={values.type === type}
                className={CHOICE_CONTROL}
              />
              <span className="flex flex-col gap-1">
                <span className="text-label text-ink">{ACCOUNT_TYPE_NAMES[type]}</span>
                <span className="text-body-sm text-body">{TYPE_DESCRIPTIONS[type]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id={`${prefix}-type-error`} error={state.fields.type} />
      </fieldset>
      <ControlField
        id={`${prefix}-institution`}
        label="Banco"
        help="Define qual extrato a conta importa."
        error={state.fields.institution}
      >
        <select
          id={`${prefix}-institution`}
          // O React devolve o select ao valor com que ele nasceu ao limpar o formulário depois do envio: a
          // chave o recria com o valor enviado, depois de uma recusa.
          key={values.institution}
          name="institution"
          defaultValue={values.institution}
          className={inputClass('app')}
          {...describedBy(`${prefix}-institution`, state.fields.institution, true)}
        >
          {(Object.keys(INSTITUTION_NAMES) as Institution[]).map((institution) => (
            <option key={institution} value={institution}>
              {INSTITUTION_NAMES[institution]}
            </option>
          ))}
        </select>
      </ControlField>
      <label className={CHOICE}>
        <input type="checkbox" name="isReserve" defaultChecked={values.isReserve} className={CHOICE_CONTROL} />
        <span className="flex flex-col gap-1">
          <span className="text-label text-ink">Conta de reserva</span>
          <span className="text-body-sm text-body">
            Uma conta de guardar dinheiro, como uma caixinha que rende. Transferir para ela conta como aplicação, e
            tirar dela, como resgate.
          </span>
        </span>
      </label>
      <div className="grid gap-6 md:grid-cols-2">
        <ControlField id={`${prefix}-opening-balance`} label="Saldo inicial (R$)" error={state.fields.openingBalance}>
          <input
            id={`${prefix}-opening-balance`}
            name="openingBalance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={values.openingBalance}
            className={`${inputClass('app')} text-right tabular-nums`}
            onBlur={(event) => {
              // Formata ao sair do campo; o que não é um valor fica como foi digitado, para a recusa.
              const decimal = parseMoneyInput(event.currentTarget.value);
              if (decimal !== null) event.currentTarget.value = formatMoneyInput(decimal);
            }}
            {...describedBy(`${prefix}-opening-balance`, state.fields.openingBalance)}
          />
        </ControlField>
        <DateField
          id={`${prefix}-opening-balance-date`}
          name="openingBalanceDate"
          label="Data do saldo inicial"
          autoComplete="off"
          size="app"
          required={false}
          defaultValue={values.openingBalanceDate}
          help="O saldo no começo desse dia, antes das movimentações dele."
          error={state.fields.openingBalanceDate}
        />
      </div>
      {account && <p className="text-body-sm text-mute">A alteração entra no histórico, com o antes e o depois.</p>}
      {/* No celular, as ações ficam fixas no rodapé, acima da área segura (design-system.md, seção 6). */}
      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-hairline bg-surface px-4 pt-3 pb-safe md:static md:mx-0 md:flex md:flex-wrap md:justify-end md:px-0 md:pt-4 md:pb-0">
        <Link href={account ? `/accounts/${account.id}` : '/accounts'} className={SECONDARY_BUTTON}>
          Cancelar
        </Link>
        <SubmitButton size="app">{account ? 'Salvar alterações' : 'Criar conta'}</SubmitButton>
      </div>
    </form>
  );
}
