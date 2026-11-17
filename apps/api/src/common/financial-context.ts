import { SetMetadata } from '@nestjs/common';

import type { EntityType, PermissionLevel } from './prisma-types.js';

// O contexto financeiro das rotas de dados (HLD, seção 4; regra 6.2). O módulo da rota a marca; a
// Identidade lê o cabeçalho, pede a resolução às Entidades e confere a permissão em cada entidade, sem
// que o módulo da rota a chame (LLD, seção 3).

/** O cabeçalho do contexto financeiro (LLD, seção 5). */
export const FINANCIAL_CONTEXT_HEADER = 'Financial-Context';

/** A chave do nível que a rota de dados exige em cada entidade do contexto, nos metadados do Nest. */
export const REQUIRED_FINANCIAL_CONTEXT = 'requiredFinancialContext';

/**
 * Marca a rota de dados: ela lê o contexto do cabeçalho, e exige o nível dado (`view` para ler,
 * `operate` para escrever) em cada entidade dele.
 */
export const RequiresFinancialContext = (level: PermissionLevel): MethodDecorator =>
  SetMetadata(REQUIRED_FINANCIAL_CONTEXT, level);

/** O contexto como o cabeçalho o nomeia: uma entidade ou um grupo, pelo id. */
export interface FinancialContextReference {
  readonly kind: 'entity' | 'group';
  readonly id: string;
}

const REFERENCE = /^(entity|group):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** O contexto do cabeçalho, ou nulo quando ele falta ou não é `entity:<id>` nem `group:<id>`. */
export function parseFinancialContext(value: string | undefined): FinancialContextReference | null {
  const match = value === undefined ? null : REFERENCE.exec(value.trim());
  if (!match) return null;
  return { kind: match[1]?.toLowerCase() as 'entity' | 'group', id: (match[2] ?? '').toLowerCase() };
}

/** Uma entidade que o contexto reúne. */
export interface FinancialContextEntityRow {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly active: boolean;
}

/** O contexto resolvido nas entidades dele: a própria entidade, ou os membros do grupo, pelo nome. */
export interface ResolvedFinancialContext extends FinancialContextReference {
  readonly name: string;
  readonly isFamilyView: boolean;
  readonly entities: readonly FinancialContextEntityRow[];
}
