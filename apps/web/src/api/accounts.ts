import 'server-only';

import { cache } from 'react';

import { type DataResult, dataResult, type ReadResult, readResult } from './api-error';
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

/** O tamanho da página da lista (design-system.md, seção 4.1). */
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
