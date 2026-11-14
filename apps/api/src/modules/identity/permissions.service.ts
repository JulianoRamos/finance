import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  type Clock,
  CLOCK,
  isForeignKeyViolation,
  type PageRequest,
  type PermissionLevel,
  TransactionService,
} from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import { EntitiesService } from '../entities/index.js';
import type { EntityPermissionPage, PermissionChange } from './identity.dto.js';

/** A recusa de uma permissão numa entidade que não existe. */
function entityNotFound() {
  return apiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'ENTITY_NOT_FOUND',
    'Uma das entidades das permissões não existe mais. Recarregue a página.',
  );
}

/** O dono da tabela `permission`: as permissões por entidade (regra 6.1), com a auditoria delas. */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly entities: EntitiesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** O nível do usuário em cada entidade em que ele tem permissão; com `entityIds`, só nessas. */
  async levelsOf(userId: string, entityIds?: readonly string[]): Promise<Map<string, PermissionLevel>> {
    const rows = await this.transactions.client.permission.findMany({
      where: { userId, ...(entityIds && { entityId: { in: [...entityIds] } }) },
      select: { entityId: true, level: true },
    });
    return new Map(rows.map((row) => [row.entityId, row.level]));
  }

  /**
   * A página de todas as entidades da busca, ativas ou não, na ordem da lista das entidades, com o nível
   * do usuário em cada uma, ou `none`.
   */
  async page(userId: string, filter: { q?: string | undefined; page: PageRequest }): Promise<EntityPermissionPage> {
    const entities = await this.entities.list(filter);
    const levels = await this.levelsOf(
      userId,
      entities.items.map((entity) => entity.id),
    );
    return {
      total: entities.total,
      page: entities.page,
      pageSize: entities.pageSize,
      items: entities.items.map((entity) => ({
        entityId: entity.id,
        type: entity.type,
        name: entity.name,
        active: entity.active,
        level: levels.get(entity.id) ?? 'none',
      })),
    };
  }

  /**
   * Grava as permissões que mudam, na transação do comando: `none` apaga a linha, e as entidades fora da
   * lista ficam como estão. Uma entidade que não existe responde 422 `ENTITY_NOT_FOUND`.
   */
  apply(userId: string, changes: readonly PermissionChange[]): Promise<void> {
    return this.transactions.run(async () => {
      for (const change of changes) {
        if (change.level === 'none') await this.remove(userId, change.entityId);
        else await this.set(userId, change.entityId, change.level);
      }
    });
  }

  /** Dá `operate` a quem cadastrou a entidade, na transação do cadastro (regra 6.1). */
  grantCreator(userId: string, entityId: string): Promise<void> {
    return this.transactions.run(() => this.set(userId, entityId, 'operate'));
  }

  /** Grava o nível do usuário na entidade, criando a linha ou trocando o nível dela. */
  private async set(userId: string, entityId: string, level: PermissionLevel): Promise<void> {
    const client = this.transactions.client;
    const before = await client.permission.findUnique({ where: { userId_entityId: { userId, entityId } } });
    if (before?.level === level) return;
    const now = this.clock.now();
    if (!before) {
      // Outro pedido pode gravar a mesma permissão entre a leitura e a criação: aí ela vira a troca do nível.
      const [created] = await client.permission
        .createManyAndReturn({
          data: [{ userId, entityId, level, createdAt: now, updatedAt: now }],
          skipDuplicates: true,
        })
        .catch((error: unknown) => {
          throw isForeignKeyViolation(error) ? entityNotFound() : error;
        });
      if (created) await this.record('create', entityId, created.id, null, created);
      else await this.set(userId, entityId, level);
      return;
    }
    const after = await client.permission.update({ where: { id: before.id }, data: { level, updatedAt: now } });
    await this.record('update', entityId, before.id, before, after);
  }

  /** Apaga a permissão do usuário na entidade, quando ela existe. */
  private async remove(userId: string, entityId: string): Promise<void> {
    const client = this.transactions.client;
    const before = await client.permission.findUnique({ where: { userId_entityId: { userId, entityId } } });
    if (!before || (await client.permission.deleteMany({ where: { id: before.id } })).count === 0) return;
    await this.record('delete', entityId, before.id, before, null);
  }

  /** A auditoria de uma permissão, com a entidade dela, para a mudança aparecer na auditoria da entidade. */
  private record(
    action: 'create' | 'update' | 'delete',
    entityId: string,
    recordId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    return this.audit.record({ action, tableName: 'permission', recordId, entityId, before, after });
  }
}
