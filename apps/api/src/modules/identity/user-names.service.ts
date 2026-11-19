import { Injectable, type OnModuleInit } from '@nestjs/common';

import { TransactionService } from '../../common/index.js';
import { type UserNames, UserNamesRegistry } from '../audit/index.js';

/**
 * A implementação da porta dos nomes dos usuários que a Auditoria declara (LLD, seção 3), registrada nela
 * na montagem da app.
 */
@Injectable()
export class UserNamesService implements UserNames, OnModuleInit {
  constructor(
    private readonly transactions: TransactionService,
    private readonly registry: UserNamesRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  /** O nome atual de cada usuário dos ids, ativo ou desativado. */
  async namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const users = await this.transactions.client.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
