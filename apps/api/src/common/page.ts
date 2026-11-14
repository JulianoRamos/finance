import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateBy } from 'class-validator';

import { Prisma } from '../generated/prisma/client.js';
import type { Transaction } from './transaction.service.js';

// A página de toda lista (LLD, seção 5): o `page` e o `pageSize` na entrada, e os itens com o total
// na saída. A busca e a ordem ficam no banco, antes de paginar.

/** O tamanho da página quando o pedido não o dá. */
const DEFAULT_PAGE_SIZE = 10;
/** O maior tamanho de página. */
const MAX_PAGE_SIZE = 100;

/** Um texto que é um inteiro de `min` a `max`, como chega na query da URL. */
function IsIntegerText(min: number, max: number, message: string): PropertyDecorator {
  return ValidateBy({
    name: 'isIntegerText',
    validator: {
      validate: (value) => {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
        const parsed = Number(value);
        return parsed >= min && parsed <= max;
      },
      defaultMessage: () => message,
    },
  });
}

/** A página pedida, que as consultas das listas estendem. */
export class PageQuery {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    default: 1,
    description:
      'A página, a partir de 1 (LLD, seção 5). Uma página depois da última vem com `items` vazio e o mesmo total.',
  })
  @IsOptional()
  @IsIntegerText(1, Number.MAX_SAFE_INTEGER, 'A página é um número inteiro a partir de 1.')
  page?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: `Quantos itens por página, de 1 a ${String(MAX_PAGE_SIZE)} (LLD, seção 5).`,
  })
  @IsOptional()
  @IsIntegerText(1, MAX_PAGE_SIZE, `O tamanho da página é um número inteiro de 1 a ${String(MAX_PAGE_SIZE)}.`)
  pageSize?: string;
}

/** A busca textual `q` de uma lista, com a descrição da rota. */
export function SearchQuery(description: string): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: String, description }),
    IsOptional(),
    IsString({ message: 'A busca precisa ser um texto.' }),
  );
}

/** Os campos de toda página na resposta, depois dos itens, que cada recurso declara com o tipo dele. */
export class PageInfo {
  @ApiProperty({ type: 'integer', description: 'Quantos itens o filtro acha, em todas as páginas.', example: 37 })
  total!: number;

  @ApiProperty({ type: 'integer', description: 'A página devolvida, a partir de 1.', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', description: 'O tamanho da página.', example: 10 })
  pageSize!: number;
}

/** A página pedida, já convertida: o número, o tamanho e quantos itens pular. */
export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly offset: number;
}

/** A página pedida na query, com os padrões no que faltar. A query já foi validada pelo `PageQuery`. */
export function pageRequest(query: PageQuery): PageRequest {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? DEFAULT_PAGE_SIZE : Number(query.pageSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * O padrão do `LIKE` da busca, que acha o texto em qualquer posição, com o `%`, o `_` e a barra da
 * busca escapados. Nulo quando a busca, aparada, é vazia: aí ela não filtra.
 */
export function searchPattern(q: string | undefined): string | null {
  const text = q?.trim() ?? '';
  return text === '' ? null : `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

/** Um trecho de SQL com os valores passados como parâmetros. */
export const sql = Prisma.sql;
export type Sql = Prisma.Sql;

/** Uma página de uma lista, como a rota a devolve. */
export interface Page<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * A página do filtro: os ids da página e o total numa consulta, e depois os registros desses ids, na
 * ordem deles. `found` seleciona o `id` e as colunas da `order`, já filtrados; a ordem termina no `id`,
 * para a página não mudar entre nomes iguais. `read` lê os registros dos ids, em qualquer ordem.
 */
export async function readPage<T extends { readonly id: string }>(
  client: Transaction,
  found: Sql,
  order: Sql,
  request: PageRequest,
  read: (ids: string[]) => Promise<T[]>,
): Promise<Page<T>> {
  const [row] = await client.$queryRaw<{ ids: string[]; total: number }[]>`
    WITH found AS (${found})
    SELECT
      (SELECT count(*)::int FROM found) AS total,
      ARRAY(SELECT id FROM found ORDER BY ${order}, id LIMIT ${request.pageSize} OFFSET ${request.offset}) AS ids`;
  const ids = row?.ids ?? [];
  const byId = new Map((ids.length > 0 ? await read(ids) : []).map((item) => [item.id, item]));
  return {
    items: ids.flatMap((id) => byId.get(id) ?? []),
    total: row?.total ?? 0,
    page: request.page,
    pageSize: request.pageSize,
  };
}
