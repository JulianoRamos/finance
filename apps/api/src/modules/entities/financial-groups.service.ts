import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { apiError, type Clock, CLOCK, type EntityType, omit, TransactionService } from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import { byName } from './fields.js';
import type { FinancialGroup, FinancialGroupEdit, NewFinancialGroup } from './financial-groups.dto.js';

/** O que a leitura do grupo traz de cada membro: a linha e a entidade dele. */
const MEMBERS_WITH_ENTITY = { members: { include: { entity: true } } } as const;

/** O grupo como o Prisma o lê, com os membros e as entidades deles. */
interface GroupRow {
  readonly id: string;
  readonly name: string;
  readonly isFamilyView: boolean;
  readonly createdAt: Date;
  readonly version: number;
  readonly updatedAt: Date;
  readonly members: readonly MemberRow[];
}

/** O membro como o Prisma o lê, com a entidade dele. */
interface MemberRow {
  readonly id: string;
  readonly financialGroupId: string;
  readonly entityId: string;
  readonly createdAt: Date;
  readonly entity: { readonly id: string; readonly type: EntityType; readonly name: string; readonly active: boolean };
}

/** O grupo como a rota o devolve, com os membros pelo nome. */
function toFinancialGroup(row: GroupRow): FinancialGroup {
  return {
    id: row.id,
    name: row.name,
    isFamilyView: row.isFamilyView,
    members: row.members
      .map(({ entity }) => ({ id: entity.id, type: entity.type, name: entity.name, active: entity.active }))
      .sort((a, b) => byName.compare(a.name, b.name)),
    createdAt: row.createdAt,
    version: row.version,
  };
}

/**
 * Os ids em minúsculas e sem repetir: o PostgreSQL compara o UUID sem diferenciar maiúsculas, e a
 * comparação com os membros atuais também não pode diferenciar.
 */
function normalizedIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

/** A recusa do grupo que não existe. */
function groupNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Este grupo não existe.');
}

/** A recusa da versão que não é a atual (regra 6.20). */
function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Este grupo mudou desde que você o abriu. Recarregue para ver os dados atuais.',
  );
}

/** A recusa de renomear ou excluir a Visão Familiar (regra 6.2). */
function familyViewProtected() {
  return apiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'FAMILY_VIEW_PROTECTED',
    'A Visão Familiar não é renomeada nem excluída.',
  );
}

/**
 * O dono das tabelas `financial_group` e `financial_group_member`: as leituras e as alterações dos
 * grupos, com a Visão Familiar. Lê as entidades pelo Prisma, no mesmo módulo.
 */
@Injectable()
export class FinancialGroupsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Os grupos, a Visão Familiar primeiro e os outros pelo nome. */
  async list(): Promise<FinancialGroup[]> {
    const rows = await this.transactions.client.financialGroup.findMany({ include: MEMBERS_WITH_ENTITY });
    return rows
      .sort((a, b) => Number(b.isFamilyView) - Number(a.isFamilyView) || byName.compare(a.name, b.name))
      .map(toFinancialGroup);
  }

  /** O grupo do id, com os membros. */
  async get(id: string): Promise<FinancialGroup> {
    return toFinancialGroup(await this.read(id));
  }

  /** Cria o grupo, na versão 1, com os membros pedidos. */
  create(input: NewFinancialGroup): Promise<FinancialGroup> {
    return this.transactions.run(async () => {
      const memberIds = normalizedIds(input.memberIds);
      await this.readNewMembers(memberIds);
      const now = this.clock.now();
      const created = await this.transactions.client.financialGroup.create({
        data: { name: input.name.trim(), createdAt: now, updatedAt: now },
      });
      await this.audit.record({
        action: 'create',
        tableName: 'financial_group',
        recordId: created.id,
        entityId: null,
        before: null,
        after: created,
      });
      await this.addMembers(created.id, memberIds);
      return toFinancialGroup(await this.read(created.id));
    });
  }

  /**
   * Troca o nome e a lista inteira dos membros do grupo, com a versão lida, na versão seguinte, mesmo
   * quando só os membros mudam. A versão vai no filtro: se outro pedido mudou o grupo depois da leitura,
   * nada é gravado, e a resposta é o conflito.
   */
  update(id: string, input: FinancialGroupEdit): Promise<FinancialGroup> {
    return this.transactions.run(async () => {
      const before = await this.lockAndRead(id);
      if (before.version !== input.version) throw versionConflict();
      const name = input.name.trim();
      if (before.isFamilyView && name !== before.name) throw familyViewProtected();
      const current = new Set(before.members.map((member) => member.entity.id));
      const memberIds = normalizedIds(input.memberIds);
      const added = memberIds.filter((entityId) => !current.has(entityId));
      const entering = await this.readNewMembers(added);
      if (before.isFamilyView && entering.some((entity) => entity.type === 'company')) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'FAMILY_VIEW_INDIVIDUALS_ONLY',
          'A Visão Familiar só aceita pessoas físicas.',
        );
      }
      const { count } = await this.transactions.client.financialGroup.updateMany({
        where: { id, version: before.version },
        data: { name, updatedAt: this.clock.now(), version: { increment: 1 } },
      });
      if (count === 0) throw versionConflict();
      const wanted = new Set(memberIds);
      await this.removeMembers(before.members.filter((member) => !wanted.has(member.entityId)));
      await this.addMembers(id, added);
      const after = await this.read(id);
      await this.audit.record({
        action: 'update',
        tableName: 'financial_group',
        recordId: id,
        entityId: null,
        before: omit(before, 'members'),
        after: omit(after, 'members'),
      });
      return toFinancialGroup(after);
    });
  }

  /**
   * Exclui o grupo: apaga os membros, sem mudar as entidades, e depois o grupo. A Visão Familiar não é
   * excluída (regra 6.2).
   */
  remove(id: string): Promise<void> {
    return this.transactions.run(async () => {
      const before = await this.lockAndRead(id);
      if (before.isFamilyView) throw familyViewProtected();
      await this.removeMembers(before.members);
      await this.transactions.client.financialGroup.delete({ where: { id } });
      await this.audit.record({
        action: 'delete',
        tableName: 'financial_group',
        recordId: id,
        entityId: null,
        before: omit(before, 'members'),
        after: null,
      });
    });
  }

  /**
   * As entidades que entram no grupo, ou a recusa: um id que não é de nenhuma entidade, ou uma entidade
   * desativada, que não entra num grupo (regra 6.2). A que já estava no grupo não passa por aqui.
   */
  private async readNewMembers(entityIds: readonly string[]) {
    if (entityIds.length === 0) return [];
    // FOR SHARE: uma desativação ao mesmo tempo espera esta transação, ou esta espera a desativação e lê
    // a entidade já desativada, e a desativada não entra no grupo sem ninguém ver.
    const entities = await this.transactions.client.$queryRaw<{ type: EntityType; active: boolean }[]>`
      SELECT type, active FROM entity WHERE id = ANY(${[...entityIds]}::uuid[]) FOR SHARE`;
    if (entities.length < entityIds.length) {
      throw apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'ENTITY_NOT_FOUND', 'Uma das entidades escolhidas não existe.');
    }
    if (entities.some((entity) => !entity.active)) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INACTIVE_ENTITY',
        'Uma entidade desativada não entra num grupo. Reative-a antes.',
      );
    }
    return entities;
  }

  /** Grava as entidades dadas como membros do grupo, uma a uma, com a auditoria de cada uma. */
  private async addMembers(financialGroupId: string, entityIds: readonly string[]) {
    const now = this.clock.now();
    for (const entityId of entityIds) {
      const after = await this.transactions.client.financialGroupMember.create({
        data: { financialGroupId, entityId, createdAt: now },
      });
      await this.audit.record({
        action: 'create',
        tableName: 'financial_group_member',
        recordId: after.id,
        entityId,
        before: null,
        after,
      });
    }
  }

  /**
   * Tira os membros dados do grupo, um a um, com a auditoria de cada um. As entidades não mudam. Um
   * membro que outro pedido já tirou não tem o que gravar.
   */
  private async removeMembers(members: readonly MemberRow[]) {
    for (const member of members) {
      const { count } = await this.transactions.client.financialGroupMember.deleteMany({ where: { id: member.id } });
      if (count === 0) continue;
      await this.audit.record({
        action: 'delete',
        tableName: 'financial_group_member',
        recordId: member.id,
        entityId: member.entityId,
        before: omit(member, 'entity'),
        after: null,
      });
    }
  }

  /**
   * Trava o grupo do id até o fim da transação e o lê, ou recusa com 404. Com a trava, a edição e a
   * exclusão do mesmo grupo correm uma depois da outra: a exclusão não deixa para trás um membro que a
   * edição acabou de pôr, e a edição que chega depois da exclusão recebe o 404.
   */
  private async lockAndRead(id: string): Promise<GroupRow> {
    await this.transactions.client.$queryRaw`SELECT 1 FROM financial_group WHERE id = ${id}::uuid FOR UPDATE`;
    return this.read(id);
  }

  /** O grupo do id, com os membros e as entidades deles, ou a recusa 404. */
  private async read(id: string): Promise<GroupRow> {
    const row = await this.transactions.client.financialGroup.findUnique({
      where: { id },
      include: MEMBERS_WITH_ENTITY,
    });
    if (!row) throw groupNotFound();
    return row;
  }
}
