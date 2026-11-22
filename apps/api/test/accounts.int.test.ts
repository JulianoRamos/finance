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
  newSessionByRoute,
  TestClock,
  uniqueName,
  uniquePrefix,
} from './support/app.js';

/** Uma conta, como o contrato a descreve. */
interface Account {
  readonly id: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly name: string;
  readonly type: 'checking' | 'payment' | 'cash';
  readonly institution: string;
  readonly isReserve: boolean;
  readonly openingBalance: string;
  readonly openingBalanceDate: string;
  readonly balance: string;
  readonly active: boolean;
  readonly version: number;
}

/** Uma página da lista das contas, como o contrato a descreve. */
interface AccountPage {
  readonly items: Account[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Um campo que mudou, como o contrato o descreve. */
interface AuditChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

/** Uma alteração do histórico, como o contrato a descreve. */
interface AuditHistoryEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly user: { readonly id: string; readonly name: string } | null;
  readonly action: 'create' | 'update' | 'delete';
  readonly tableName: string;
  readonly recordId: string;
  readonly subject: string | null;
  readonly changes: AuditChange[];
}

/** Uma página do histórico, como o contrato a descreve. */
interface AuditHistoryPage {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly items: AuditHistoryEntry[];
}

/** Uma entidade, só com o que os testes das contas usam. */
interface Entity {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

/** O corpo do cadastro de uma conta. */
interface NewAccount {
  readonly entityId: string;
  readonly name: string;
  readonly type: string;
  readonly institution: string;
  readonly isReserve: boolean;
  readonly openingBalance: string;
  readonly openingBalanceDate: string;
}

describe('Contas', () => {
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

  /** Cadastra uma entidade ativa, em que quem a cadastra recebe `operate`, e a devolve. */
  async function newEntity(token: string, type: 'individual' | 'company', name = uniqueName('Conta')) {
    return (await authed(token, 'post', '/v1/entities').send({ type, name }).expect(201)).body as Entity;
  }

  /** Um cadastro de conta corrente do Nubank na entidade, com o saldo inicial zero. */
  function accountBody(entityId: string, overrides: Partial<NewAccount> = {}): NewAccount {
    return {
      entityId,
      name: uniqueName('Nubank'),
      type: 'checking',
      institution: 'nubank',
      isReserve: false,
      openingBalance: '0.00',
      openingBalanceDate: '2026-09-01',
      ...overrides,
    };
  }

  /** O pedido de cadastrar uma conta. */
  function create(token: string, body: unknown, requestId?: string) {
    return authed(token, 'post', '/v1/accounts', requestId).send(body as object);
  }

  /** Cadastra uma conta na entidade e a devolve. */
  async function newAccount(token: string, entityId: string, overrides: Partial<NewAccount> = {}) {
    return (await create(token, accountBody(entityId, overrides)).expect(201)).body as Account;
  }

  /** O pedido de desativar ou reativar uma conta. */
  function setActive(token: string, account: { id: string; version: number }, active: boolean, requestId?: string) {
    return authed(token, 'put', `/v1/accounts/${account.id}/active`, requestId).send({
      active,
      version: account.version,
    });
  }

  /** O pedido de editar uma conta. */
  function edit(token: string, id: string, body: unknown, requestId?: string) {
    return authed(token, 'put', `/v1/accounts/${id}`, requestId).send(body as object);
  }

  /** O pedido de ler uma conta. */
  function get(token: string, id: string) {
    return authed(token, 'get', `/v1/accounts/${id}`);
  }

  /** O pedido da lista das contas, com o contexto financeiro dado. */
  function list(token: string, context: string | null, query: Record<string, string> = {}) {
    const pending = authed(token, 'get', '/v1/accounts').query(query);
    return context === null ? pending : pending.set('Financial-Context', context);
  }

  /** A página da lista das contas no contexto, que responde 200. */
  async function pageOf(token: string, context: string, query: Record<string, string>): Promise<AccountPage> {
    return (await list(token, context, query).expect(200)).body as AccountPage;
  }

  it('cadastra a conta na entidade em que o usuário opera e recusa nas outras', { tags: ['@KAN-23-CA1'] }, async () => {
    const owner = await newSession(app);
    const company = await newEntity(owner, 'company');
    const { token } = await newSessionByRoute(app, owner, {
      permissions: [{ entityId: company.id, level: 'view' }],
    });
    const person = await newEntity(token, 'individual', uniqueName('Ana Lima'));
    const body = accountBody(person.id, {
      isReserve: true,
      openingBalance: '-150.25',
      openingBalanceDate: '2026-09-01',
    });

    const created = (await create(token, body).expect(201)).body as Account;

    expect(created).toEqual({
      id: expect.any(String) as string,
      entityId: person.id,
      entityName: person.name,
      name: body.name,
      type: 'checking',
      institution: 'nubank',
      isReserve: true,
      openingBalance: '-150.25',
      openingBalanceDate: '2026-09-01',
      balance: '-150.25',
      active: true,
      version: 1,
    });

    for (const entityId of [company.id, randomUUID()]) {
      const refused = await create(token, accountBody(entityId)).expect(403);
      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
    }

    const inactive = await newEntity(token, 'individual');
    await authed(token, 'put', `/v1/entities/${inactive.id}/active`)
      .send({ active: false, version: inactive.version })
      .expect(200);
    const refusedInactive = await create(token, accountBody(inactive.id)).expect(422);
    expect(refusedInactive.body).toMatchObject({ code: 'INACTIVE_ENTITY' });

    const invalid: [string, Record<string, unknown>][] = [
      ['name', { name: undefined }],
      ['type', { type: 'credit_card' }],
      ['openingBalance', { openingBalance: '12.345' }],
    ];
    for (const [field, overrides] of invalid) {
      const response = await create(token, { ...accountBody(person.id), ...overrides }).expect(400);
      expect(response.body).toMatchObject({
        code: 'INVALID_INPUT',
        fields: { [field]: expect.any(String) as string },
      });
    }
  });

  it('lista as contas do contexto, paginadas e com a busca', { tags: ['@KAN-23-CA2'] }, async () => {
    const token = await newSession(app);
    const marker = uniquePrefix();
    const named = (suffix: string) => `Cônta ${marker.toUpperCase()} ${suffix}`;
    const a = await newEntity(token, 'individual');
    const b = await newEntity(token, 'individual');
    const c = await newEntity(token, 'individual');
    const group = (
      (
        await authed(token, 'post', '/v1/financial-groups')
          .send({ name: uniqueName('Grupo das contas'), memberIds: [a.id, b.id] })
          .expect(201)
      ).body as { id: string }
    ).id;
    const inactive = await newAccount(token, a.id, { name: named('a') });
    const ab = await newAccount(token, a.id, { name: named('b') });
    const bc = await newAccount(token, b.id, { name: named('c') });
    const ad = await newAccount(token, a.id, { name: named('d') });
    const be = await newAccount(token, b.id, { name: named('e') });
    const cf = await newAccount(token, c.id, { name: named('f') });
    const deactivated = (await setActive(token, inactive, false).expect(200)).body as Account;
    const q = `conta ${marker}`;

    const all = await pageOf(token, `group:${group}`, { q });

    expect(all).toEqual({ items: [ab, bc, ad, be, deactivated], total: 5, page: 1, pageSize: 10 });
    expect(await pageOf(token, `group:${group}`, { q, pageSize: '2', page: '3' })).toEqual({
      items: [deactivated],
      total: 5,
      page: 3,
      pageSize: 2,
    });
    expect(await pageOf(token, `group:${group}`, { q, pageSize: '2', page: '4' })).toEqual({
      items: [],
      total: 5,
      page: 4,
      pageSize: 2,
    });
    expect((await pageOf(token, `group:${group}`, { q, active: 'true' })).items).toEqual([ab, bc, ad, be]);
    expect(await pageOf(token, `entity:${c.id}`, { q })).toMatchObject({ items: [cf], total: 1 });
    const missing = await list(token, null, { q }).expect(400);
    expect(missing.body).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('edita a conta e recusa a troca da entidade dona', { tags: ['@KAN-23-CA3'] }, async () => {
    const token = await newSession(app);
    const person = await newEntity(token, 'individual');
    const other = await newEntity(token, 'individual');
    const account = await newAccount(token, person.id, {
      name: uniqueName('Itaú'),
      institution: 'itau',
      openingBalance: '100.00',
      openingBalanceDate: '2026-09-01',
    });
    const changes = {
      entityId: person.id,
      name: uniqueName('Mercado Pago'),
      type: 'payment',
      institution: 'mercado_pago',
      isReserve: true,
      openingBalance: '2500.10',
      openingBalanceDate: '2026-10-15',
    };

    const edited = (await edit(token, account.id, { version: account.version, ...changes }).expect(200))
      .body as Account;

    const expected = { ...account, ...changes, balance: '2500.10', version: 2 };
    expect(edited).toEqual(expected);
    expect((await get(token, account.id).expect(200)).body).toEqual(expected);

    const moved = await edit(token, account.id, { ...changes, version: 2, entityId: other.id }).expect(422);
    expect(moved.body).toMatchObject({ code: 'ACCOUNT_OWNER_IMMUTABLE' });
    expect((await get(token, account.id).expect(200)).body).toEqual(expected);

    const { token: viewer } = await newSessionByRoute(app, token, {
      permissions: [{ entityId: person.id, level: 'view' }],
    });
    expect((await get(viewer, account.id).expect(200)).body).toEqual(expected);
    const refused = await edit(viewer, account.id, { ...changes, version: 2 }).expect(403);
    expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });

    const missing = randomUUID();
    expect((await get(token, missing).expect(404)).body).toMatchObject({ code: 'NOT_FOUND' });
    expect((await edit(token, missing, { ...changes, version: 1 }).expect(404)).body).toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('desativa e reativa a conta, sem excluir, e recusa a versão antiga', { tags: ['@KAN-23-CA4'] }, async () => {
    const token = await newSession(app);
    const person = await newEntity(token, 'individual');
    const context = `entity:${person.id}`;
    const account = await newAccount(token, person.id);

    const deactivated = (await setActive(token, account, false).expect(200)).body as Account;

    expect(deactivated).toEqual({ ...account, active: false, version: 2 });
    expect((await pageOf(token, context, { active: 'true' })).items).toEqual([]);
    expect((await pageOf(token, context, {})).items).toEqual([deactivated]);
    expect((await get(token, account.id).expect(200)).body).toEqual(deactivated);

    const again = (await setActive(token, account, false).expect(200)).body as Account;
    expect(again).toEqual(deactivated);

    const reactivated = (await setActive(token, deactivated, true).expect(200)).body as Account;
    expect(reactivated).toEqual({ ...account, version: 3 });
    expect((await pageOf(token, context, { active: 'true' })).items).toEqual([reactivated]);

    const { id, entityId, name, type, institution, isReserve, openingBalance, openingBalanceDate } = account;
    const stale = await edit(token, id, {
      version: 2,
      entityId,
      name,
      type,
      institution,
      isReserve,
      openingBalance,
      openingBalanceDate,
    }).expect(409);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });

    await authed(token, 'delete', `/v1/accounts/${id}`).expect(404);
    expect((await get(token, id).expect(200)).body).toEqual(reactivated);
  });

  it(
    'a criação, a edição e a desativação da conta ficam na auditoria e no histórico',
    { tags: ['@KAN-23-CA5'] },
    async () => {
      const token = await newSession(app);
      const session = (await getCurrentSession(app, token).expect(200)).body as {
        user: { id: string; name: string };
      };
      const user = { id: session.user.id, name: session.user.name };
      const person = await newEntity(token, 'individual');
      const requestIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()] as const;
      const oldName = uniqueName('Caixa');
      const newName = uniqueName('Caixa da casa');
      const account = (
        await create(
          token,
          accountBody(person.id, {
            name: oldName,
            institution: 'caixa',
            openingBalance: '-150.25',
            openingBalanceDate: '2026-09-01',
          }),
          requestIds[0],
        ).expect(201)
      ).body as Account;
      const { id, entityId, type, institution, isReserve, openingBalanceDate } = account;
      const edited = (
        await edit(
          token,
          id,
          {
            version: 1,
            entityId,
            name: newName,
            type,
            institution,
            isReserve,
            openingBalance: '320.75',
            openingBalanceDate,
          },
          requestIds[1],
        ).expect(200)
      ).body as Account;
      const deactivated = (await setActive(token, edited, false, requestIds[2]).expect(200)).body as Account;
      await setActive(token, deactivated, true, requestIds[3]).expect(200);

      const history = (await authed(token, 'get', `/v1/accounts/${id}/history`).expect(200)).body as AuditHistoryPage;

      const entry = (action: AuditHistoryEntry['action'], changes: AuditChange[]) => ({
        id: expect.any(String) as string,
        occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
        user,
        action,
        tableName: 'account',
        recordId: id,
        subject: null,
        changes,
      });
      expect(history).toMatchObject({ total: 4, page: 1, pageSize: 10 });
      expect(history.items).toEqual([
        entry('update', [{ field: 'active', before: false, after: true }]),
        entry('update', [{ field: 'active', before: true, after: false }]),
        entry('update', [
          { field: 'name', before: oldName, after: newName },
          { field: 'openingBalance', before: '-150.25', after: '320.75' },
        ]),
        entry('create', [
          { field: 'name', before: null, after: oldName },
          { field: 'type', before: null, after: 'checking' },
          { field: 'institution', before: null, after: 'caixa' },
          { field: 'isReserve', before: null, after: false },
          { field: 'openingBalance', before: null, after: '-150.25' },
          { field: 'openingBalanceDate', before: null, after: '2026-09-01' },
          { field: 'active', before: null, after: true },
        ]),
      ]);

      const audit = await app.get(PrismaService).auditLog.findMany({
        where: { tableName: 'account', recordId: id },
        orderBy: { id: 'asc' },
      });
      expect(audit.map((row) => ({ requestId: row.requestId, entityId: row.entityId }))).toEqual(
        requestIds.map((requestId) => ({ requestId, entityId: person.id })),
      );

      const { token: stranger } = await newSessionByRoute(app, token);
      const refused = await authed(stranger, 'get', `/v1/accounts/${id}/history`).expect(403);
      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
    },
  );
});
