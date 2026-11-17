import { Injectable } from '@nestjs/common';

import {
  type FinancialContextReference,
  type ResolvedFinancialContext,
  TransactionService,
} from '../../common/index.js';
import { membersByName } from './financial-groups.service.js';

/** Só o que o contexto mostra de cada entidade. */
const ENTITY_FIELDS = { id: true, type: true, name: true, active: true } as const;

/**
 * A resolução do contexto financeiro (HLD, seção 4): a entidade ou o grupo do cabeçalho, com as entidades
 * que ele reúne. Quem confere a permissão em cada uma é a Identidade.
 */
@Injectable()
export class FinancialContextService {
  constructor(private readonly transactions: TransactionService) {}

  /**
   * O contexto resolvido: a própria entidade, ativa ou não, ou o grupo com os membros, ativos ou não.
   * Nulo quando o id não é de nenhuma entidade ou de nenhum grupo.
   */
  async resolve(reference: FinancialContextReference): Promise<ResolvedFinancialContext | null> {
    const client = this.transactions.client;
    if (reference.kind === 'entity') {
      const entity = await client.entity.findUnique({ where: { id: reference.id }, select: ENTITY_FIELDS });
      if (!entity) return null;
      return { kind: 'entity', id: entity.id, name: entity.name, isFamilyView: false, entities: [entity] };
    }
    const group = await client.financialGroup.findUnique({
      where: { id: reference.id },
      select: { id: true, name: true, isFamilyView: true, members: { select: { entity: { select: ENTITY_FIELDS } } } },
    });
    if (!group) return null;
    return {
      kind: 'group',
      id: group.id,
      name: group.name,
      isFamilyView: group.isFamilyView,
      entities: membersByName(group.members),
    };
  }
}
