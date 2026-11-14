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
import { alphanumericCnpj, formatCnpj, uniqueCnpj, uniqueCpf } from './support/tax-ids.js';

/** Uma entidade, como o contrato a descreve. */
interface Entity {
  readonly id: string;
  readonly type: 'individual' | 'company';
  readonly name: string;
  readonly taxId: string | null;
  readonly active: boolean;
  readonly operations: string[];
  readonly version: number;
}

/** Uma página da lista das entidades, como o contrato a descreve. */
interface EntityPage {
  readonly items: Entity[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

describe('Entidades', () => {
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

  /** O pedido de cadastrar uma entidade. */
  function create(token: string, body: Record<string, unknown>, requestId?: string) {
    return authed(token, 'post', '/v1/entities', requestId).send(body);
  }

  /** O pedido de ligar (PUT) ou desligar (DELETE) a operação de clínica na entidade. */
  function setOperation(token: string, id: string, method: 'put' | 'delete', requestId?: string) {
    return authed(token, method, `/v1/entities/${id}/operations/clinic`, requestId);
  }

  /** O pedido de desativar ou reativar a entidade, com a versão. */
  function setActive(token: string, id: string, active: boolean, version: number, requestId?: string) {
    return authed(token, 'put', `/v1/entities/${id}/active`, requestId).send({ active, version });
  }

  /** O pedido de editar a entidade. */
  function edit(token: string, id: string, body: Record<string, unknown>, requestId?: string) {
    return authed(token, 'put', `/v1/entities/${id}`, requestId).send(body);
  }

  /** O pedido de ler a entidade. */
  function get(token: string, id: string) {
    return authed(token, 'get', `/v1/entities/${id}`);
  }

  /** A página da lista das entidades vista com o token, que responde 200. */
  async function pageOf(token: string, query: Record<string, string>): Promise<EntityPage> {
    const response = await authed(token, 'get', '/v1/entities').query(query).expect(200);
    return response.body as EntityPage;
  }

  /** As entidades da primeira página da busca, vista com o token. */
  async function listOf(token: string, query: Record<string, string>): Promise<Entity[]> {
    return (await pageOf(token, query)).items;
  }

  it('cadastra pessoas físicas e jurídicas, com o documento opcional', { tags: ['@KAN-11-CA1'] }, async () => {
    const token = await newSession(app);
    const cnpj = uniqueCnpj();
    const personName = uniqueName('Ana');
    const companyName = uniqueName('Clínica');

    const person = await create(token, { type: 'individual', name: personName }).expect(201);
    const company = await create(token, { type: 'company', name: companyName, taxId: formatCnpj(cnpj) }).expect(201);

    const common = { active: true, operations: [], version: 1 };
    expect(person.body).toMatchObject({ ...common, type: 'individual', name: personName, taxId: null });
    expect(company.body).toMatchObject({ ...common, type: 'company', name: companyName, taxId: cnpj });
    expect(await listOf(token, { q: personName })).toEqual([person.body]);
    expect(await listOf(token, { q: companyName })).toEqual([company.body]);
  });

  it('recusa um documento repetido ou inválido', { tags: ['@KAN-11-CA1'] }, async () => {
    const token = await newSession(app);
    const cnpj = uniqueCnpj();
    await create(token, { type: 'company', name: uniqueName('Clínica'), taxId: formatCnpj(cnpj) }).expect(201);
    const repeatedName = uniqueName('Repetida');

    const repeated = await create(token, { type: 'company', name: repeatedName, taxId: cnpj }).expect(422);
    const invalid = await create(token, {
      type: 'individual',
      name: uniqueName('Ana'),
      taxId: '529.982.247-24',
    }).expect(400);

    expect(repeated.body).toMatchObject({ code: 'DUPLICATE_TAX_ID' });
    expect(await listOf(token, { q: repeatedName })).toEqual([]);
    expect(invalid.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (invalid.body as { fields?: { taxId?: unknown } }).fields?.taxId).toBe('string');
  });

  it('liga e desliga a operação de clínica numa empresa', { tags: ['@KAN-11-CA2'] }, async () => {
    const token = await newSession(app);
    const cnpj = uniqueCnpj();
    const name = uniqueName('Clínica');
    const company = (await create(token, { type: 'company', name, taxId: cnpj }).expect(201)).body as Entity;

    const enabled = await setOperation(token, company.id, 'put').expect(200);
    const enabledAgain = await setOperation(token, company.id, 'put').expect(200);
    const disabled = await setOperation(token, company.id, 'delete').expect(200);

    expect(enabled.body).toMatchObject({ id: company.id, operations: ['clinic'] });
    expect(enabledAgain.body).toEqual(enabled.body);
    expect(disabled.body).toMatchObject({ id: company.id, operations: [], active: true, name, taxId: cnpj });
    await setOperation(token, company.id, 'put').expect(200);
    const listed = (await listOf(token, { q: name })).find((entity) => entity.id === company.id);
    expect(listed?.operations).toEqual(['clinic']);
  });

  it('recusa a operação numa pessoa física', { tags: ['@KAN-11-CA2'] }, async () => {
    const token = await newSession(app);
    const person = (await create(token, { type: 'individual', name: uniqueName('Ana') }).expect(201)).body as Entity;
    const refusedName = uniqueName('Bia');

    const enabled = await setOperation(token, person.id, 'put').expect(422);
    const created = await create(token, { type: 'individual', name: refusedName, operations: ['clinic'] }).expect(422);

    expect(enabled.body).toMatchObject({ code: 'OPERATION_REQUIRES_COMPANY' });
    expect(created.body).toMatchObject({ code: 'OPERATION_REQUIRES_COMPANY' });
    expect((await listOf(token, { q: person.name })).find((entity) => entity.id === person.id)?.operations).toEqual([]);
    expect(await listOf(token, { q: refusedName })).toEqual([]);
  });

  it('a entidade desativada some das escolhas e continua cadastrada', { tags: ['@KAN-11-CA3'] }, async () => {
    const token = await newSession(app);
    const company = (
      await create(token, { type: 'company', name: uniqueName('Clínica'), operations: ['clinic'] }).expect(201)
    ).body as Entity;

    const deactivated = await setActive(token, company.id, false, company.version).expect(200);

    expect(deactivated.body).toMatchObject({ id: company.id, active: false, operations: ['clinic'] });
    expect((await get(token, company.id).expect(200)).body).toEqual(deactivated.body);
    expect(await listOf(token, { q: company.name })).toContainEqual(deactivated.body);
    expect((await listOf(token, { q: company.name, active: 'true' })).map((entity) => entity.id)).not.toContain(
      company.id,
    );
    await authed(token, 'delete', `/v1/entities/${company.id}`).expect(404);

    const reactivated = await setActive(token, company.id, true, (deactivated.body as Entity).version).expect(200);

    expect(reactivated.body).toMatchObject({ active: true });
    expect((await listOf(token, { q: company.name, active: 'true' })).map((entity) => entity.id)).toContain(company.id);
  });

  it('pagina as entidades e busca pelo nome e pelo documento', { tags: ['@KAN-19-CA1'] }, async () => {
    const token = await newSession(app);
    const prefix = uniquePrefix();
    const cnpj = uniqueCnpj();
    const people = ['Júlia', 'Ana', 'Igor', 'Ágata', 'Helena', 'Bruno', 'Gustavo', 'Diego', 'Fábio', 'Elisa'];
    const created = new Map<string, Entity>();
    for (const first of people) {
      const body = (await create(token, { type: 'individual', name: `${first} ${prefix}` }).expect(201)).body as Entity;
      created.set(first, body);
    }
    const company = (await create(token, { type: 'company', name: `Clínica ${prefix}`, taxId: cnpj }).expect(201))
      .body as Entity;
    const abel = (await create(token, { type: 'individual', name: `Abel ${prefix}` }).expect(201)).body as Entity;
    await setActive(token, abel.id, false, abel.version).expect(200);

    const second = await pageOf(token, { q: prefix, page: '2', pageSize: '5' });
    const third = await pageOf(token, { q: prefix, page: '3', pageSize: '5' });

    expect({ ...second, items: second.items.map((entity) => entity.name) }).toEqual({
      items: ['Elisa', 'Fábio', 'Gustavo', 'Helena', 'Igor'].map((first) => `${first} ${prefix}`),
      total: 12,
      page: 2,
      pageSize: 5,
    });
    // As ativas primeiro: a desativada, que vem antes pelo nome, fecha a lista.
    expect(third.items.map((entity) => entity.name)).toEqual([`Júlia ${prefix}`, `Abel ${prefix}`]);
    expect(await listOf(token, { q: `agata ${prefix.toUpperCase()}` })).toEqual([created.get('Ágata')]);
    expect(await listOf(token, { q: formatCnpj(cnpj) })).toEqual([company]);
    const active = await pageOf(token, { q: prefix, active: 'true', pageSize: '100' });
    expect(active.total).toBe(11);
    expect(active.items.map((entity) => entity.id)).not.toContain(abel.id);
  });

  it('a busca acha o CNPJ só pelos algarismos, e nunca o CPF', async () => {
    const token = await newSession(app);
    const prefix = uniquePrefix();
    const cpf = uniqueCpf();
    const person = (await create(token, { type: 'individual', name: `Ana ${prefix}`, taxId: cpf }).expect(201))
      .body as Entity;
    // Um CNPJ alfanumérico com as letras do nome buscado abaixo.
    const company = (
      await create(token, { type: 'company', name: `Clínica ${prefix}`, taxId: alphanumericCnpj('ZZ') }).expect(201)
    ).body as Entity;

    expect(await listOf(token, { q: cpf })).toEqual([]);
    expect(await listOf(token, { q: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}` })).not.toContainEqual(person);
    expect(await listOf(token, { q: company.taxId ?? '' })).toEqual([company]);
    expect(await listOf(token, { q: 'zz' })).not.toContainEqual(company);
  });

  it('recusa a edição com a versão desatualizada', { tags: ['@KAN-11-CA4'] }, async () => {
    const token = await newSession(app);
    const person = (await create(token, { type: 'individual', name: uniqueName('Ana') }).expect(201)).body as Entity;
    const [firstName, secondName] = [uniqueName('Ana Maria'), uniqueName('Ana Clara')];

    const edited = await edit(token, person.id, { version: 1, type: 'individual', name: firstName }).expect(200);
    const stale = await edit(token, person.id, { version: 1, type: 'individual', name: secondName }).expect(409);
    const staleDeactivation = await setActive(token, person.id, false, 1).expect(409);

    expect(edited.body).toMatchObject({ name: firstName, version: 2 });
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(staleDeactivation.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await get(token, person.id).expect(200)).body).toMatchObject({ name: firstName, version: 2, active: true });
  });

  it('recusa a edição que muda o tipo', { tags: ['@KAN-11-CA7'] }, async () => {
    const token = await newSession(app);
    const name = uniqueName('Ana');
    const person = (await create(token, { type: 'individual', name }).expect(201)).body as Entity;

    const refused = await edit(token, person.id, {
      version: person.version,
      type: 'company',
      name: uniqueName('Ana Ltda'),
    }).expect(422);

    expect(refused.body).toMatchObject({ code: 'ENTITY_TYPE_IMMUTABLE' });
    expect((await get(token, person.id).expect(200)).body).toMatchObject({
      type: 'individual',
      name,
      version: person.version,
    });
  });

  it('a criação, a edição, a desativação e as operações ficam na auditoria', { tags: ['@KAN-11-CA6'] }, async () => {
    const token = await newSession(app);
    const userId = ((await getCurrentSession(app, token).expect(200)).body as { user: { id: string } }).user.id;
    const cnpj = uniqueCnpj();
    const [name, newName] = [uniqueName('Clínica'), uniqueName('Clínica Nova')];
    const requestIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()] as const;

    const created = await create(
      token,
      { type: 'company', name, taxId: cnpj, operations: ['clinic'] },
      requestIds[0],
    ).expect(201);
    const { id } = created.body as Entity;
    await edit(token, id, { version: 1, type: 'company', name: newName, taxId: cnpj }, requestIds[1]).expect(200);
    await edit(token, id, { version: 1, type: 'company', name: uniqueName('Recusada'), taxId: cnpj }).expect(409);
    await setActive(token, id, false, 2, requestIds[2]).expect(200);
    await setOperation(token, id, 'delete', requestIds[3]).expect(200);

    const prisma = app.get(PrismaService);
    const auditOf = (tableName: string) =>
      prisma.auditLog.findMany({ where: { tableName, entityId: id }, orderBy: { id: 'asc' } });
    const common = { userId, entityId: id };
    expect(await auditOf('entity')).toMatchObject([
      {
        ...common,
        recordId: id,
        action: 'create',
        requestId: requestIds[0],
        before: null,
        after: { name, taxId: cnpj },
      },
      {
        ...common,
        recordId: id,
        action: 'update',
        requestId: requestIds[1],
        before: { name },
        after: { name: newName },
      },
      {
        ...common,
        recordId: id,
        action: 'update',
        requestId: requestIds[2],
        before: { active: true },
        after: { active: false },
      },
    ]);
    const operations = await auditOf('entity_operation');
    expect(operations).toMatchObject([
      { ...common, action: 'create', requestId: requestIds[0], before: null, after: { operation: 'clinic' } },
      { ...common, action: 'delete', requestId: requestIds[3], before: { operation: 'clinic' }, after: null },
    ]);
    expect(operations[1]?.recordId).toBe(operations[0]?.recordId);
  });

  it('pedir o estado que a entidade já tem responde 200 sem mudar a versão, mesmo com a versão antiga', async () => {
    const token = await newSession(app);
    const person = (await create(token, { type: 'individual', name: uniqueName('Ana') }).expect(201)).body as Entity;
    const deactivated = (await setActive(token, person.id, false, person.version).expect(200)).body as Entity;

    // Outra aba, ainda na versão de antes, pede a mesma desativação.
    const repeated = await setActive(token, person.id, false, person.version).expect(200);

    expect(repeated.body).toEqual(deactivated);
  });

  it('recusa a mudança de tipo com 422 também quando o documento é do tipo de antes', async () => {
    const token = await newSession(app);
    const cpf = uniqueCpf();
    const person = (await create(token, { type: 'individual', name: uniqueName('Ana'), taxId: cpf }).expect(201))
      .body as Entity;

    const refused = await edit(token, person.id, {
      version: person.version,
      type: 'company',
      name: person.name,
      taxId: cpf,
    }).expect(422);

    expect(refused.body).toMatchObject({ code: 'ENTITY_TYPE_IMMUTABLE' });
  });

  it('recusa na edição o documento que não é do tipo da entidade', async () => {
    const token = await newSession(app);
    const company = (await create(token, { type: 'company', name: uniqueName('Clínica') }).expect(201)).body as Entity;

    const refused = await edit(token, company.id, {
      version: company.version,
      type: 'company',
      name: company.name,
      taxId: '00.000.000/0001-92',
    }).expect(400);

    expect(refused.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (refused.body as { fields?: { taxId?: unknown } }).fields?.taxId).toBe('string');
    expect((await get(token, company.id).expect(200)).body).toMatchObject({ taxId: null, version: 1 });
  });
});
