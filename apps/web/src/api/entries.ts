import 'server-only';

import { cache } from 'react';

import { type DataResult, dataResult, type ReadResult, readResult } from './api-error';
import { api } from './client';
import { currentFinancialContext } from './financial-context';
import type { components } from './schema';

export type Entry = components['schemas']['Entry'];
export type EntryType = Entry['type'];
export type EntryPurpose = NonNullable<Entry['purpose']>;
export type EntryMonthItem = components['schemas']['EntryMonthItem'];
export type EntryMonthPage = components['schemas']['EntryMonthPage'];
export type Installment = components['schemas']['Installment'];
export type InstallmentStatus = Installment['status'];
export type InstallmentPage = components['schemas']['InstallmentPage'];
export type NewEntry = components['schemas']['NewEntry'];

/** O tamanho da página da lista do mês e da tabela das parcelas (design-system.md, seções 4.1 e 4.4). */
const PAGE_SIZE = 10;

/** O filtro da lista do mês: o mês `AAAA-MM`, o tipo, a busca e a página. */
export interface EntryListQuery {
  readonly month: string;
  readonly type: EntryType | null;
  readonly q: string;
  readonly page: number;
}

/**
 * A página das parcelas do mês das pessoas físicas do contexto financeiro escolhido, com o tipo e a busca,
 * pedida uma vez por requisição, mesmo que o layout e a página peçam a mesma: o `cache` compara os
 * argumentos um a um, então eles vão soltos. Sem nenhum contexto, quando o usuário não vê nenhuma
 * entidade, não há lançamento para mostrar.
 */
const readEntries = cache(
  async (month: string, type: EntryType | null, q: string, page: number): Promise<ReadResult<EntryMonthPage>> => {
    const context = await currentFinancialContext();
    if (context.status === 'none') return { status: 'ok', data: { items: [], total: 0, page, pageSize: PAGE_SIZE } };
    if (context.status !== 'ok') return { status: context.status };
    return readResult((init) =>
      api.GET('/v1/entries', {
        params: {
          header: { 'Financial-Context': context.reference },
          query: { month, page, pageSize: PAGE_SIZE, q, ...(type && { type }) },
        },
        ...init,
      }),
    );
  },
);

/** A página das parcelas do mês do filtro dado (ver `readEntries`). */
export function listEntries(query: EntryListQuery): Promise<ReadResult<EntryMonthPage>> {
  return readEntries(query.month, query.type, query.q, query.page);
}

/** O lançamento do id; `not-found` quando ele não existe, o usuário não o vê, ou o id nem é um id. */
export function getEntry(id: string): Promise<ReadResult<Entry>> {
  return readResult((init) => api.GET('/v1/entries/{id}', { params: { path: { id } }, ...init }));
}

/** A página das parcelas do lançamento, pelo número, de 10 em 10. */
export function listInstallments(id: string, page: number): Promise<ReadResult<InstallmentPage>> {
  return readResult((init) =>
    api.GET('/v1/entries/{id}/installments', {
      params: { path: { id }, query: { page, pageSize: PAGE_SIZE } },
      ...init,
    }),
  );
}

/** Registra um lançamento de uma pessoa física, com as parcelas. */
export function createEntry(body: NewEntry): Promise<DataResult<Entry>> {
  return dataResult((signal) => api.POST('/v1/entries', { body, signal }));
}
