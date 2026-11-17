import 'server-only';

import { cache } from 'react';

import { type ReadResult, readResult } from './api-error';
import { api } from './client';
import { storedFinancialContext } from './financial-context-cookie';
import type { components } from './schema';

export type FinancialContext = components['schemas']['FinancialContext'];
export type FinancialContextEntity = FinancialContext['entities'][number];

/** O cabeçalho do contexto financeiro (LLD, seção 5). */
const FINANCIAL_CONTEXT_HEADER = 'Financial-Context';

/** Quantos contextos o seletor mostra em cada grupo (design-system.md, seção 4.1). */
const OPTIONS_PER_GROUP = 5;

/** Uma escolha do seletor: o contexto na forma do cabeçalho e o nome dele. */
export interface ContextOption {
  readonly reference: string;
  readonly name: string;
}

/** As escolhas de um grupo do seletor: as primeiras e quantas a busca acha ao todo. */
export interface ContextOptionGroup {
  readonly items: readonly ContextOption[];
  readonly total: number;
}

/** As escolhas do seletor, nos três grupos dele. */
export interface ContextOptions {
  readonly groups: ContextOptionGroup;
  readonly individuals: ContextOptionGroup;
  readonly companies: ContextOptionGroup;
}

/** Os três grupos do seletor, na ordem dele. */
type OptionKind = keyof ContextOptions;

/** Uma página de uma lista da api, com o que o seletor usa de cada item. */
interface OptionPage {
  readonly items: readonly { id: string; name: string }[];
  readonly total: number;
}

/**
 * A página do grupo do seletor para a busca, pedida à api: os grupos que o usuário vê, ou as entidades
 * ativas dele de um tipo.
 */
function readOptions(kind: OptionKind, q: string, pageSize: number): Promise<ReadResult<OptionPage>> {
  const query = { page: 1, pageSize, q };
  if (kind === 'groups')
    return readResult<OptionPage>((init) => api.GET('/v1/financial-groups', { params: { query }, ...init }));
  const type = kind === 'individuals' ? 'individual' : 'company';
  return readResult<OptionPage>((init) =>
    api.GET('/v1/entities', { params: { query: { ...query, active: true, type } }, ...init }),
  );
}

/** A página como um grupo do seletor, com cada item na forma do cabeçalho. */
function toOptionGroup(kind: OptionKind, page: OptionPage): ContextOptionGroup {
  const prefix = kind === 'groups' ? 'group' : 'entity';
  return {
    items: page.items.map((item) => ({ reference: `${prefix}:${item.id}`, name: item.name })),
    total: page.total,
  };
}

/**
 * As escolhas do seletor para a busca, pedidas à api: os grupos que o usuário vê e as entidades ativas
 * dele, cada tipo à parte, até cinco de cada. Nulo quando a api não responde como o contrato diz.
 */
export async function listContextOptions(q: string): Promise<ContextOptions | null> {
  const [groups, individuals, companies] = await Promise.all([
    readOptions('groups', q, OPTIONS_PER_GROUP),
    readOptions('individuals', q, OPTIONS_PER_GROUP),
    readOptions('companies', q, OPTIONS_PER_GROUP),
  ]);
  if (groups.status !== 'ok' || individuals.status !== 'ok' || companies.status !== 'ok') return null;
  return {
    groups: toOptionGroup('groups', groups.data),
    individuals: toOptionGroup('individuals', individuals.data),
    companies: toOptionGroup('companies', companies.data),
  };
}

/**
 * O primeiro contexto do seletor, na forma do cabeçalho, sem pedir os grupos seguintes quando um já tem
 * algum; `none` quando o usuário não vê nenhum, `unauthenticated` sem uma sessão válida, ou `unavailable`
 * quando a api não responde.
 */
async function firstContextReference(): Promise<
  { status: 'ok'; reference: string } | { status: 'none' | 'unauthenticated' | 'unavailable' }
> {
  for (const kind of ['groups', 'individuals', 'companies'] as const) {
    const page = await readOptions(kind, '', 1);
    if (page.status === 'unauthenticated') return { status: 'unauthenticated' };
    if (page.status !== 'ok') return { status: 'unavailable' };
    const [first] = toOptionGroup(kind, page.data).items;
    if (first) return { status: 'ok', reference: first.reference };
  }
  return { status: 'none' };
}

/** O contexto do cabeçalho dado, lido na rota de dados; `not-found` quando a api o recusa. */
function readFinancialContext(reference: string): Promise<ReadResult<FinancialContext>> {
  return readResult((init) =>
    api.GET('/v1/financial-context', {
      params: { header: { [FINANCIAL_CONTEXT_HEADER]: reference } },
      ...init,
    }),
  );
}

/**
 * O contexto financeiro da requisição: o escolhido; `none` quando o usuário não vê nenhuma entidade
 * nem grupo; `unauthenticated` sem uma sessão válida; ou `unavailable` quando a api não responde.
 */
export type CurrentFinancialContext =
  | { status: 'ok'; reference: string; context: FinancialContext }
  | { status: 'none' }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

/** O contexto do cabeçalho dado, como o contexto da requisição, ou `not-found` quando a api o recusa. */
async function contextOf(reference: string): Promise<CurrentFinancialContext | { status: 'not-found' }> {
  const read = await readFinancialContext(reference);
  return read.status === 'ok' ? { status: 'ok', reference, context: read.data } : { status: read.status };
}

/**
 * O contexto financeiro escolhido, pedido uma vez por requisição. Sem escolha, ou quando a api recusa a
 * guardada, vale o primeiro contexto do seletor, a Visão Familiar quando o usuário a vê (regra 6.2), sem
 * regravar o cookie.
 */
export const currentFinancialContext = cache(async (): Promise<CurrentFinancialContext> => {
  const stored = await storedFinancialContext();
  if (stored) {
    const current = await contextOf(stored);
    if (current.status !== 'not-found') return current;
  }
  const first = await firstContextReference();
  if (first.status !== 'ok') return first;
  const current = await contextOf(first.reference);
  return current.status === 'not-found' ? { status: 'none' } : current;
});
