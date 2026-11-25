import 'server-only';

import { cache } from 'react';

import { type DataResult, dataResult, MAX_PAGE_SIZE, type ReadResult, readAllPages, readResult } from './api-error';
import { api } from './client';
import type { AuditHistoryPage } from './entities';
import { currentFinancialContext } from './financial-context';
import type { components } from './schema';

export type Account = components['schemas']['Account'];
export type AccountType = Account['type'];
export type Institution = Account['institution'];
type NewAccount = components['schemas']['NewAccount'];
type AccountEdit = components['schemas']['AccountEdit'];

export type AccountPage = components['schemas']['AccountPage'];

/** Uma página das contas do contexto financeiro, as ativas primeiro e cada grupo pelo nome. */
export type AccountList = ReadResult<AccountPage>;

/** O tamanho da página da lista e da tabela das movimentações (design-system.md, seções 4.1 e 4.4). */
const PAGE_SIZE = 10;

/**
 * A página das contas do contexto financeiro escolhido, com a busca, pedida uma vez por requisição, mesmo
 * que o layout e a página peçam a mesma. Sem nenhum contexto, quando o usuário não vê nenhuma entidade,
 * não há conta para mostrar.
 */
export const listAccounts = cache(async (page = 1, q = ''): Promise<AccountList> => {
  const context = await currentFinancialContext();
  if (context.status === 'none') return { status: 'ok', data: { items: [], total: 0, page, pageSize: PAGE_SIZE } };
  if (context.status !== 'ok') return { status: context.status };
  return readResult((init) =>
    api.GET('/v1/accounts', {
      params: { header: { 'Financial-Context': context.reference }, query: { page, pageSize: PAGE_SIZE, q } },
      ...init,
    }),
  );
});

/** A conta do id; `not-found` quando ela não existe, o usuário não a vê, ou o id nem é um id. */
export function getAccount(id: string): Promise<ReadResult<Account>> {
  return readResult((init) => api.GET('/v1/accounts/{id}', { params: { path: { id } }, ...init }));
}

/** O resultado de um comando sobre uma conta: ela, como ficou, ou o erro do contrato. */
export type AccountResult = DataResult<Account>;

/** Cadastra uma conta numa entidade. */
export function createAccount(body: NewAccount): Promise<AccountResult> {
  return dataResult((signal) => api.POST('/v1/accounts', { body, signal }));
}

/** Troca os dados de uma conta, com a versão lida. A entidade dona vai igual: ela não muda. */
export function updateAccount(id: string, body: AccountEdit): Promise<AccountResult> {
  return dataResult((signal) => api.PUT('/v1/accounts/{id}', { params: { path: { id } }, body, signal }));
}

/** Desativa ou reativa uma conta, com a versão lida. */
export function setAccountActive(id: string, active: boolean, version: number): Promise<AccountResult> {
  return dataResult((signal) =>
    api.PUT('/v1/accounts/{id}/active', { params: { path: { id } }, body: { active, version }, signal }),
  );
}

/** A página do histórico de alterações da conta, da mais recente para a mais antiga, de 10 em 10. */
export function getAccountHistory(id: string, page: number): Promise<ReadResult<AuditHistoryPage>> {
  return readResult((init) =>
    api.GET('/v1/accounts/{id}/history', { params: { path: { id }, query: { page, pageSize: 10 } }, ...init }),
  );
}

export type Movement = components['schemas']['Movement'];
export type MovementDirection = Movement['direction'];
type NewMovement = components['schemas']['NewMovement'];
type NewAdjustment = components['schemas']['NewAdjustment'];
export type MovementPage = components['schemas']['MovementPage'];
export type AccountBalance = components['schemas']['AccountBalance'];

/** A página das movimentações da conta, da mais recente para a mais antiga, de 10 em 10. */
export function listMovements(id: string, page: number): Promise<ReadResult<MovementPage>> {
  return readResult((init) =>
    api.GET('/v1/accounts/{id}/movements', {
      params: { path: { id }, query: { page, pageSize: PAGE_SIZE } },
      ...init,
    }),
  );
}

/**
 * O saldo da conta no fim do dia `AAAA-MM-DD`, ou o erro do contrato, que a tela diz: a data antes do saldo
 * inicial (`DATE_BEFORE_OPENING_BALANCE`) não tem saldo.
 */
export function getAccountBalance(id: string, date: string): Promise<DataResult<AccountBalance>> {
  return dataResult((signal) =>
    api.GET('/v1/accounts/{id}/balance', { params: { path: { id }, query: { date } }, cache: 'no-store', signal }),
  );
}

/** Registra uma movimentação manual na conta. */
export function createMovement(id: string, body: NewMovement): Promise<DataResult<Movement>> {
  return dataResult((signal) => api.POST('/v1/accounts/{id}/movements', { params: { path: { id } }, body, signal }));
}

/**
 * Ajusta o saldo da conta ao do banco numa data: a api grava a diferença para o saldo calculado como uma
 * movimentação de origem `adjustment`, com o motivo na descrição (regra 6.3).
 */
export function createAdjustment(id: string, body: NewAdjustment): Promise<DataResult<Movement>> {
  return dataResult((signal) => api.POST('/v1/accounts/{id}/adjustments', { params: { path: { id } }, body, signal }));
}

/** Uma escolha de conta de um lançamento: o id, o nome e a entidade dona. */
export type AccountChoice = Pick<Account, 'id' | 'name' | 'entityId'>;

/**
 * Todas as contas ativas do contexto financeiro escolhido, as que um lançamento pode escolher, pelo nome,
 * lidas de 100 em 100.
 */
export async function listAccountChoices(): Promise<ReadResult<AccountChoice[]>> {
  const context = await currentFinancialContext();
  if (context.status === 'none') return { status: 'ok', data: [] };
  if (context.status !== 'ok') return { status: context.status };
  return readAllPages(
    (page) =>
      readResult((init) =>
        api.GET('/v1/accounts', {
          params: {
            header: { 'Financial-Context': context.reference },
            query: { page, pageSize: MAX_PAGE_SIZE, active: true },
          },
          ...init,
        }),
      ),
    ({ id, name, entityId }) => ({ id, name, entityId }),
  );
}
