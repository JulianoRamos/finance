import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  type Clock,
  CLOCK,
  type EntityType,
  isUniqueViolation,
  type Operation,
  TransactionService,
} from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import type { Entity, EntityEdit, NewEntity } from './entities.dto.js';
import { invalidTaxIdMessage, isValidTaxId, normalizeTaxId } from './tax-id.js';

/** A ordem dos nomes em português, que põe "Ágata" junto de "Ana", e não depois de "Zélia". */
const byName = new Intl.Collator('pt-BR');

/** A entidade como o Prisma a lê, com as operações ligadas. */
interface EntityRow {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly taxId: string | null;
  readonly active: boolean;
  readonly version: number;
  readonly operations: readonly { readonly operation: Operation }[];
}

/** O registro da tabela `entity`, sem as operações, que são de outra tabela, para a auditoria. */
function withoutOperations(row: EntityRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([column]) => column !== 'operations'));
}

/** A entidade como a rota a devolve, com as operações em ordem alfabética. */
function toEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    taxId: row.taxId,
    active: row.active,
    operations: row.operations.map((enabled) => enabled.operation).sort(),
    version: row.version,
  };
}

/**
 * Troca a violação do único do documento pela recusa dele: o documento já é de outra entidade, ativa
 * ou não, também quando outro pedido o gravou ao mesmo tempo.
 */
function rethrowDuplicateTaxId(error: unknown): never {
  throw isUniqueViolation(error)
    ? apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DUPLICATE_TAX_ID',
        'Este documento já está cadastrado em outra entidade.',
      )
    : error;
}

/** A recusa da versão que não é a atual (regra 6.20). */
function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Esta entidade mudou desde que você a abriu. Recarregue para ver os dados atuais.',
  );
}

/** A recusa da operação numa pessoa física (regra 6.2). */
function operationRequiresCompany() {
  return apiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'OPERATION_REQUIRES_COMPANY',
    'Operações só se ligam em pessoa jurídica.',
  );
}

/** O dono das tabelas `entity` e `entity_operation`: as leituras e as alterações, com a auditoria delas. */
@Injectable()
export class EntitiesService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** As entidades, as ativas primeiro e cada grupo pelo nome; com `active`, só as desse estado. */
  async list(active?: boolean): Promise<Entity[]> {
    const rows = await this.transactions.client.entity.findMany({
      where: active === undefined ? {} : { active },
      include: { operations: true },
    });
    return rows.sort((a, b) => Number(b.active) - Number(a.active) || byName.compare(a.name, b.name)).map(toEntity);
  }

  /** A entidade do id, ativa ou desativada. */
  async get(id: string): Promise<Entity> {
    return toEntity(await this.read(id));
  }

  /** Troca o nome e o documento da entidade, com a versão lida. As operações não mudam por aqui. */
  update(id: string, input: EntityEdit): Promise<Entity> {
    const taxId = normalizeTaxId(input.taxId);
    return this.transactions.run(async () => {
      const before = await this.read(id);
      if (before.version !== input.version) throw versionConflict();
      if (before.type !== input.type) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'ENTITY_TYPE_IMMUTABLE',
          'O tipo da entidade não muda depois do cadastro.',
        );
      }
      // O documento é conferido contra o tipo só depois da recusa da mudança de tipo (ver o DTO).
      if (taxId !== null && !isValidTaxId(before.type, taxId)) {
        throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Confira os campos informados.', {
          taxId: invalidTaxIdMessage(before.type),
        });
      }
      return toEntity(await this.updateVersioned(before, { name: input.name.trim(), taxId }));
    });
  }

  /**
   * Desativa ou reativa a entidade, com a versão lida. Pedir o estado que ela já tem não muda nada, e
   * responde com ela mesmo de uma versão antiga, como a de outra aba que pediu o mesmo. Desativar não
   * desliga as operações nem apaga nada (regra 6.2).
   */
  setActive(id: string, active: boolean, version: number): Promise<Entity> {
    return this.transactions.run(async () => {
      const before = await this.read(id);
      if (before.active === active) return toEntity(before);
      if (before.version !== version) throw versionConflict();
      return toEntity(await this.updateVersioned(before, { active }));
    });
  }

  /** Cria a entidade, ativa e na versão 1. */
  create(input: NewEntity): Promise<Entity> {
    const taxId = normalizeTaxId(input.taxId);
    const operations = input.operations ?? [];
    if (input.type === 'individual' && operations.length > 0) throw operationRequiresCompany();
    return this.transactions.run(async () => {
      const now = this.clock.now();
      const created = await this.transactions.client.entity
        .create({
          data: {
            type: input.type,
            name: input.name.trim(),
            taxId,
            createdAt: now,
            updatedAt: now,
          },
        })
        .catch(rethrowDuplicateTaxId);
      await this.audit.record({
        action: 'create',
        tableName: 'entity',
        recordId: created.id,
        entityId: created.id,
        before: null,
        after: created,
      });
      const enabled: { operation: Operation }[] = [];
      for (const operation of operations) enabled.push(...(await this.addOperation(created.id, operation)));
      return toEntity({ ...created, operations: enabled });
    });
  }

  /**
   * Liga a operação na empresa, na hora, sem a versão: ligar a que já está ligada não muda nada, também
   * quando dois pedidos a ligam ao mesmo tempo.
   */
  enableOperation(id: string, operation: Operation): Promise<Entity> {
    return this.transactions.run(async () => {
      const entity = await this.read(id);
      if (entity.type === 'individual') throw operationRequiresCompany();
      await this.addOperation(id, operation);
      // A operação está ligada agora, por este pedido ou por outro que a ligou ao mesmo tempo.
      const operations = new Map(
        entity.operations.map((enabled) => [enabled.operation, { operation: enabled.operation }]),
      );
      operations.set(operation, { operation });
      return toEntity({ ...entity, operations: [...operations.values()] });
    });
  }

  /** Desliga a operação na empresa, apagando a linha, e não os registros dela (regra 6.2). */
  disableOperation(id: string, operation: Operation): Promise<Entity> {
    return this.transactions.run(async () => {
      const entity = await this.read(id);
      const before = new Map(entity.operations.map((enabled) => [enabled.operation, enabled])).get(operation);
      // Outro pedido pode ter desligado a operação entre a leitura e a exclusão: aí não há o que gravar.
      if (before && (await this.transactions.client.entityOperation.deleteMany({ where: { id: before.id } })).count) {
        await this.audit.record({
          action: 'delete',
          tableName: 'entity_operation',
          recordId: before.id,
          entityId: id,
          before,
          after: null,
        });
      }
      return toEntity({ ...entity, operations: entity.operations.filter((enabled) => enabled !== before) });
    });
  }

  /**
   * Grava os dados na entidade lida, na versão seguinte, com a auditoria. A versão vai no filtro: se
   * outro pedido mudou a entidade depois da leitura, nada é gravado, e a resposta é o conflito.
   */
  private async updateVersioned(before: EntityRow, data: { active?: boolean; name?: string; taxId?: string | null }) {
    const { count } = await this.transactions.client.entity
      .updateMany({
        where: { id: before.id, version: before.version },
        data: { ...data, updatedAt: this.clock.now(), version: { increment: 1 } },
      })
      .catch(rethrowDuplicateTaxId);
    if (count === 0) throw versionConflict();
    const after = await this.read(before.id);
    await this.audit.record({
      action: 'update',
      tableName: 'entity',
      recordId: before.id,
      entityId: before.id,
      before: withoutOperations(before),
      after: withoutOperations(after),
    });
    return after;
  }

  /**
   * Grava a operação ligada na empresa, com a auditoria, se ela ainda não estava ligada, e devolve a
   * linha criada, ou nenhuma.
   */
  private async addOperation(entityId: string, operation: Operation) {
    const created = await this.transactions.client.entityOperation.createManyAndReturn({
      data: [{ entityId, operation, createdAt: this.clock.now() }],
      skipDuplicates: true,
    });
    for (const after of created) {
      await this.audit.record({
        action: 'create',
        tableName: 'entity_operation',
        recordId: after.id,
        entityId,
        before: null,
        after,
      });
    }
    return created;
  }

  /** A entidade do id, com as operações, ou a recusa 404. */
  private async read(id: string) {
    const row = await this.transactions.client.entity.findUnique({ where: { id }, include: { operations: true } });
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Esta entidade não existe.');
    return row;
  }
}
