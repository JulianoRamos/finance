import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/common/index.js';
import {
  authedRequest,
  buildTestApp,
  getCurrentSession,
  newSession,
  TestClock,
  uniqueName,
  uniquePrefix,
} from './support/app.js';

/** Um membro de um grupo, como o contrato o descreve. */
interface FinancialGroupMember {
  readonly id: string;
  readonly type: 'individual' | 'company';
  readonly name: string;
  readonly active: boolean;
}

/** Um grupo financeiro, como o contrato o descreve. */
interface FinancialGroup {
  readonly id: string;
  readonly name: string;
  readonly isFamilyView: boolean;
  readonly members: FinancialGroupMember[];
  readonly createdAt: string;
  readonly version: number;
}

/** Uma página da lista dos grupos, como o contrato a descreve. */
interface FinancialGroupPage {
  readonly items: FinancialGroup[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Uma entidade, só com o que os testes dos grupos usam. */
interface Entity {
  readonly id: string;
  readonly type: 'individual' | 'company';
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
}

/** A entidade como membro de um grupo. */
function asMember(entity: Entity): FinancialGroupMember {
  return { id: entity.id, type: entity.type, name: entity.name, active: entity.active };
}

describe('Grupos financeiros', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão e, quando dado, o identificador da requisição. */
  function authed(token: string, method: 'get' | 'post' | 'put' | 'delete', url: string, requestId?: string) {
    return authedRequest(app, token, method, url, requestId);
  }

  /** Cadastra uma entidade ativa e a devolve. */
  async function newEntity(token: string, type: Entity['type'], prefix: string): Promise<Entity> {
    const response = await authed(token, 'post', '/v1/entities')
      .send({ type, name: uniqueName(prefix) })
      .expect(201);
    return response.body as Entity;
  }

  /** O pedido de criar um grupo. */
  function create(token: string, body: { name: string; memberIds: string[] }, requestId?: string) {
    return authed(token, 'post', '/v1/financial-groups', requestId).send(body);
  }

  /** O pedido de editar um grupo. */
  function edit(
    token: string,
    id: string,
    body: { version: number; name: string; memberIds: string[] },
    requestId?: string,
  ) {
    return authed(token, 'put', `/v1/financial-groups/${id}`, requestId).send(body);
  }

  /** O pedido de ler um grupo. */
  function get(token: string, id: string) {
    return authed(token, 'get', `/v1/financial-groups/${id}`);
  }

  /** A página da lista dos grupos vista com o token, que responde 200. */
  async function pageOf(token: string, query: Record<string, string>): Promise<FinancialGroupPage> {
    return (await authed(token, 'get', '/v1/financial-groups').query(query).expect(200)).body as FinancialGroupPage;
  }

  /** Os grupos da página da busca, vista com o token. */
  async function listOf(token: string, query: Record<string, string>): Promise<FinancialGroup[]> {
    return (await pageOf(token, query)).items;
  }

  /** A Visão Familiar, lida na lista: a primeira. */
  async function familyViewOf(token: string): Promise<FinancialGroup> {
    const [first] = await listOf(token, {});
    if (!first?.isFamilyView) throw new Error('A lista dos grupos não começa pela Visão Familiar.');
    return first;
  }

  /** Os ids dos membros do grupo, com os dados acrescentados. */
  function memberIdsWith(group: FinancialGroup, ...added: Entity[]): string[] {
    return [...group.members.map((member) => member.id), ...added.map((entity) => entity.id)];
  }

  // Só este arquivo altera a Visão Familiar do finance_test, e cada teste manda a lista inteira lida antes.
  it('a Visão Familiar aceita pessoa física e recusa pessoa jurídica', { tags: ['@KAN-12-CA2'] }, async () => {
    const token = await newSession(app);
    const person = await newEntity(token, 'individual', 'Ana');
    const company = await newEntity(token, 'company', 'Clínica');
    const before = await familyViewOf(token);

    const refused = await edit(token, before.id, {
      version: before.version,
      name: before.name,
      memberIds: memberIdsWith(before, company),
    }).expect(422);
    const unchanged = (await get(token, before.id).expect(200)).body as FinancialGroup;
    const accepted = await edit(token, before.id, {
      version: before.version,
      name: before.name,
      memberIds: memberIdsWith(before, person),
    }).expect(200);

    expect(refused.body).toMatchObject({ code: 'FAMILY_VIEW_INDIVIDUALS_ONLY' });
    expect(unchanged).toEqual(before);
    expect((accepted.body as FinancialGroup).members).toContainEqual(asMember(person));
    expect((accepted.body as FinancialGroup).version).toBe(before.version + 1);
  });

  it(
    'exclui um grupo, e a Visão Familiar recusa a mudança de nome e a exclusão',
    { tags: ['@KAN-12-CA6'] },
    async () => {
      const token = await newSession(app);
      const ana = await newEntity(token, 'individual', 'Ana');
      const group = (await create(token, { name: uniqueName('Grupo'), memberIds: [ana.id] }).expect(201))
        .body as FinancialGroup;
      const familyView = await familyViewOf(token);

      await authed(token, 'delete', `/v1/financial-groups/${group.id}`).expect(204);
      const read = await get(token, group.id).expect(404);
      const listed = await listOf(token, { q: group.name });
      const entity = await authed(token, 'get', `/v1/entities/${ana.id}`).expect(200);
      const again = await authed(token, 'delete', `/v1/financial-groups/${group.id}`).expect(404);
      const renamed = await edit(token, familyView.id, {
        version: familyView.version,
        name: 'Família',
        memberIds: memberIdsWith(familyView),
      }).expect(422);
      const removed = await authed(token, 'delete', `/v1/financial-groups/${familyView.id}`).expect(422);

      expect(read.body).toMatchObject({ code: 'NOT_FOUND' });
      expect(listed.map((listedGroup) => listedGroup.id)).not.toContain(group.id);
      expect(entity.body).toMatchObject({ id: ana.id, active: true });
      expect(again.body).toMatchObject({ code: 'NOT_FOUND' });
      expect(renamed.body).toMatchObject({ code: 'FAMILY_VIEW_PROTECTED' });
      expect(removed.body).toMatchObject({ code: 'FAMILY_VIEW_PROTECTED' });
      expect((await listOf(token, {}))[0]).toMatchObject({
        id: familyView.id,
        name: 'Visão Familiar',
        version: familyView.version,
      });
    },
  );

  it('cria, renomeia e muda os membros de um grupo', { tags: ['@KAN-12-CA3'] }, async () => {
    const token = await newSession(app);
    const ana = await newEntity(token, 'individual', 'Ana');
    const bia = await newEntity(token, 'individual', 'Bia');
    const clinic = await newEntity(token, 'company', 'Clínica');
    const name = uniqueName('Tudo da Ana');
    const newName = uniqueName('Tudo da Bia');

    const created = await create(token, { name: `  ${name}  `, memberIds: [clinic.id, ana.id] }).expect(201);
    const group = created.body as FinancialGroup;
    const listed = await listOf(token, { q: name });
    const familyView = await familyViewOf(token);
    const edited = await edit(token, group.id, { version: 1, name: newName, memberIds: [ana.id, bia.id] }).expect(200);
    const read = await get(token, group.id).expect(200);

    expect(group).toMatchObject({ name, isFamilyView: false, members: [asMember(ana), asMember(clinic)], version: 1 });
    expect(typeof group.createdAt).toBe('string');
    expect(familyView.isFamilyView).toBe(true);
    expect(listed).toEqual([group]);
    expect(edited.body).toEqual({ ...group, name: newName, members: [asMember(ana), asMember(bia)], version: 2 });
    expect(read.body).toEqual(edited.body);
  });

  it('recusa a edição com a versão desatualizada', { tags: ['@KAN-12-CA3'] }, async () => {
    const token = await newSession(app);
    const ana = await newEntity(token, 'individual', 'Ana');
    const bia = await newEntity(token, 'individual', 'Bia');
    const group = (await create(token, { name: uniqueName('Grupo'), memberIds: [ana.id] }).expect(201))
      .body as FinancialGroup;
    const edited = await edit(token, group.id, { version: 1, name: uniqueName('Grupo'), memberIds: [ana.id] }).expect(
      200,
    );

    const stale = await edit(token, group.id, { version: 1, name: uniqueName('Outro'), memberIds: [bia.id] }).expect(
      409,
    );

    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await get(token, group.id).expect(200)).body).toEqual(edited.body);
  });

  it('pagina os grupos e busca pelo nome', { tags: ['@KAN-19-CA2'] }, async () => {
    const token = await newSession(app);
    const prefix = uniquePrefix();
    const names = [
      'Quebec',
      'Ônibus',
      'Alfa',
      'Papa',
      'Índia',
      'Beta',
      'Hotel',
      'Caixa',
      'Gama',
      'Delta',
      'Fase',
      'Eco',
    ];
    const created = new Map<string, FinancialGroup>();
    for (const first of names) {
      const response = await create(token, { name: `${first} ${prefix}`, memberIds: [] }).expect(201);
      created.set(first, response.body as FinancialGroup);
    }

    const third = await pageOf(token, { q: prefix, page: '3', pageSize: '5' });
    const firstPage = await pageOf(token, {});
    const familyView = await pageOf(token, { q: 'visao familiar' });

    // Na ordem pt-BR, "Índia" e "Ônibus" ficam entre "Hotel" e "Papa", e não no fim.
    expect({ ...third, items: third.items.map((group) => group.name) }).toEqual({
      items: [`Papa ${prefix}`, `Quebec ${prefix}`],
      total: 12,
      page: 3,
      pageSize: 5,
    });
    expect(await listOf(token, { q: `onibus ${prefix}` })).toEqual([created.get('Ônibus')]);
    expect(firstPage.items[0]).toMatchObject({ isFamilyView: true, name: 'Visão Familiar' });
    expect(familyView.items[0]).toMatchObject({ isFamilyView: true, name: 'Visão Familiar' });
  });

  it('uma entidade desativada não entra num grupo e continua no que já estava', { tags: ['@KAN-12-CA3'] }, async () => {
    const token = await newSession(app);
    const ana = await newEntity(token, 'individual', 'Ana');
    const bia = await newEntity(token, 'individual', 'Bia');
    const inactive = await newEntity(token, 'individual', 'Carla');
    await authed(token, 'put', `/v1/entities/${inactive.id}/active`).send({ active: false, version: 1 }).expect(200);
    const refusedName = uniqueName('Recusado');
    const group = (await create(token, { name: uniqueName('Grupo'), memberIds: [ana.id, bia.id] }).expect(201))
      .body as FinancialGroup;

    const created = await create(token, { name: refusedName, memberIds: [ana.id, inactive.id] }).expect(422);
    const added = await edit(token, group.id, {
      version: 1,
      name: group.name,
      memberIds: [ana.id, bia.id, inactive.id],
    }).expect(422);
    const unchanged = (await get(token, group.id).expect(200)).body as FinancialGroup;
    await authed(token, 'put', `/v1/entities/${bia.id}/active`).send({ active: false, version: 1 }).expect(200);
    const kept = await edit(token, group.id, {
      version: 1,
      name: uniqueName('Grupo'),
      memberIds: [ana.id, bia.id],
    }).expect(200);

    expect(created.body).toMatchObject({ code: 'INACTIVE_ENTITY' });
    expect(added.body).toMatchObject({ code: 'INACTIVE_ENTITY' });
    expect(unchanged).toEqual(group);
    expect(await listOf(token, { q: refusedName })).toEqual([]);
    expect((kept.body as FinancialGroup).members).toEqual([asMember(ana), { ...asMember(bia), active: false }]);
    expect((kept.body as FinancialGroup).version).toBe(2);
  });
  it(
    'a criação, a edição, a exclusão e os membros dos grupos ficam na auditoria',
    { tags: ['@KAN-12-CA5'] },
    async () => {
      const token = await newSession(app);
      const userId = ((await getCurrentSession(app, token).expect(200)).body as { user: { id: string } }).user.id;
      const [ana, bia, carla] = [
        await newEntity(token, 'individual', 'Ana'),
        await newEntity(token, 'individual', 'Bia'),
        await newEntity(token, 'individual', 'Carla'),
      ];
      const [name, newName] = [uniqueName('Grupo'), uniqueName('Grupo Novo')];
      const requestIds = [randomUUID(), randomUUID(), randomUUID()] as const;

      const created = await create(token, { name, memberIds: [ana.id, bia.id] }, requestIds[0]).expect(201);
      const { id } = created.body as FinancialGroup;
      await edit(token, id, { version: 1, name: newName, memberIds: [ana.id, carla.id] }, requestIds[1]).expect(200);
      await authed(token, 'delete', `/v1/financial-groups/${id}`, requestIds[2]).expect(204);

      const prisma = app.get(PrismaService);
      const groupAudit = await prisma.auditLog.findMany({
        where: { tableName: 'financial_group', recordId: id },
        orderBy: { id: 'asc' },
      });
      /** A auditoria dos membros da entidade, na ordem em que foi gravada. */
      const memberAuditOf = (entity: Entity) =>
        prisma.auditLog.findMany({
          where: { tableName: 'financial_group_member', entityId: entity.id },
          orderBy: { id: 'asc' },
        });
      const common = { userId, entityId: null, recordId: id };
      expect(groupAudit).toMatchObject([
        { ...common, action: 'create', requestId: requestIds[0], before: null, after: { name } },
        {
          ...common,
          action: 'update',
          requestId: requestIds[1],
          before: { name, version: 1 },
          after: { name: newName, version: 2 },
        },
        { ...common, action: 'delete', requestId: requestIds[2], before: { name: newName }, after: null },
      ]);
      const member = { financialGroupId: id };
      const entered = (entity: Entity, requestId: string) => ({
        userId,
        entityId: entity.id,
        action: 'create',
        requestId,
        before: null,
        after: { ...member, entityId: entity.id },
      });
      const left = (entity: Entity, requestId: string) => ({
        userId,
        entityId: entity.id,
        action: 'delete',
        requestId,
        before: { ...member, entityId: entity.id },
        after: null,
      });
      expect(await memberAuditOf(ana)).toMatchObject([entered(ana, requestIds[0]), left(ana, requestIds[2])]);
      expect(await memberAuditOf(bia)).toMatchObject([entered(bia, requestIds[0]), left(bia, requestIds[1])]);
      expect(await memberAuditOf(carla)).toMatchObject([entered(carla, requestIds[1]), left(carla, requestIds[2])]);
    },
  );
});
