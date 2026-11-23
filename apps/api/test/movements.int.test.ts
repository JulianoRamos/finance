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
} from './support/app.js';

/** Uma entidade, só com o que os testes das movimentações usam. */
interface Entity {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

/** Uma conta, só com o que os testes das movimentações usam. */
interface Account {
  readonly id: string;
  readonly version: number;
  readonly balance: string;
}

/** Uma movimentação, como o contrato a descreve. */
interface Movement {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly amount: string;
  readonly direction: 'inflow' | 'outflow';
  readonly source: 'manual';
}

/** Uma página das movimentações, como o contrato a descreve. */
interface MovementPage {
  readonly items: Movement[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** O saldo de uma conta numa data, como o contrato o descreve. */
interface AccountBalance {
  readonly date: string;
  readonly balance: string;
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
  readonly changes: { readonly field: string; readonly before: unknown; readonly after: unknown }[];
}

/** O corpo do registro de uma movimentação. */
interface NewMovement {
  readonly direction: string;
  readonly date: string;
  readonly amount: string;
  readonly description: string;
}

describe('Movimentações', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão e, quando dado, o identificador da requisição. */
  function authed(token: string, method: 'get' | 'post' | 'put', url: string, requestId?: string) {
    return authedRequest(app, token, method, url, requestId);
  }

  /** Cadastra uma entidade ativa, em que quem a cadastra recebe `operate`, e a devolve. */
  async function newEntity(token: string, type: 'individual' | 'company' = 'individual') {
    return (
      await authed(token, 'post', '/v1/entities')
        .send({ type, name: uniqueName('Movimento') })
        .expect(201)
    ).body as Entity;
  }

  /** Cadastra uma conta corrente na entidade, com o saldo inicial dado, e a devolve. */
  async function newAccount(
    token: string,
    entityId: string,
    openingBalance = '0.00',
    openingBalanceDate = '2026-09-01',
  ) {
    return (
      await authed(token, 'post', '/v1/accounts')
        .send({
          entityId,
          name: uniqueName('Nubank'),
          type: 'checking',
          institution: 'nubank',
          isReserve: false,
          openingBalance,
          openingBalanceDate,
        })
        .expect(201)
    ).body as Account;
  }

  /** Uma saída de mercado, com o que o teste trocar. */
  function movementBody(overrides: Partial<NewMovement> = {}): NewMovement {
    return {
      direction: 'outflow',
      date: '2026-11-19',
      amount: '182.45',
      description: 'Mercado Bom Preço',
      ...overrides,
    };
  }

  /** O pedido de registrar uma movimentação na conta. */
  function register(token: string, accountId: string, body: unknown, requestId?: string) {
    return authed(token, 'post', `/v1/accounts/${accountId}/movements`, requestId).send(body as object);
  }

  it(
    'registra a movimentação manual e recusa o valor que não é positivo e a conta desativada',
    { tags: ['@KAN-24-CA1'] },
    async () => {
      const owner = await newSession(app);
      const other = await newEntity(owner);
      const otherAccount = await newAccount(owner, other.id);
      const { token } = await newSessionByRoute(app, owner, {
        permissions: [{ entityId: other.id, level: 'view' }],
      });
      const person = await newEntity(token);
      const account = await newAccount(token, person.id);
      const body = movementBody();

      const created = (await register(token, account.id, body).expect(201)).body as Movement;

      expect(created).toEqual({
        id: expect.any(String) as string,
        date: '2026-11-19',
        description: 'Mercado Bom Preço',
        amount: '182.45',
        direction: 'outflow',
        source: 'manual',
      });

      const invalid: [string, Record<string, unknown>][] = [
        ['amount', { amount: '0' }],
        ['amount', { amount: '-10' }],
        ['amount', { amount: '1.234' }],
        ['description', { description: undefined }],
        ['direction', { direction: 'sideways' }],
      ];
      for (const [field, overrides] of invalid) {
        const response = await register(token, account.id, { ...body, ...overrides }).expect(400);
        expect(response.body).toMatchObject({
          code: 'INVALID_INPUT',
          fields: { [field]: expect.any(String) as string },
        });
      }

      expect((await register(token, otherAccount.id, body).expect(403)).body).toMatchObject({ code: 'FORBIDDEN' });
      expect((await register(token, randomUUID(), body).expect(404)).body).toMatchObject({ code: 'NOT_FOUND' });

      await authed(token, 'put', `/v1/accounts/${account.id}/active`)
        .send({ active: false, version: account.version })
        .expect(200);
      expect((await register(token, account.id, body).expect(422)).body).toMatchObject({ code: 'INACTIVE_ACCOUNT' });

      const inactive = await newEntity(token);
      const inactiveAccount = await newAccount(token, inactive.id);
      await authed(token, 'put', `/v1/entities/${inactive.id}/active`)
        .send({ active: false, version: inactive.version })
        .expect(200);
      expect((await register(token, inactiveAccount.id, body).expect(422)).body).toMatchObject({
        code: 'INACTIVE_ENTITY',
      });
    },
  );

  it(
    'o saldo numa data soma as movimentações desde o saldo inicial, inclusive',
    { tags: ['@KAN-24-CA2'] },
    async () => {
      // Meio-dia de 15/09 em São Paulo (UTC-3), o fuso da api, antes de abrir a sessão, que vence com o
      // relógio.
      clock.set(new Date('2026-09-15T15:00:00Z'));
      const token = await newSession(app);
      const person = await newEntity(token);
      const account = await newAccount(token, person.id, '100.00', '2026-09-01');
      const movements: NewMovement[] = [
        movementBody({ direction: 'inflow', amount: '1000.00', date: '2026-08-31', description: 'Antes do saldo' }),
        movementBody({ direction: 'inflow', amount: '50.00', date: '2026-09-01', description: 'No dia do saldo' }),
        movementBody({ direction: 'outflow', amount: '30.25', date: '2026-09-10', description: 'Farmácia' }),
        movementBody({ direction: 'inflow', amount: '10.00', date: '2026-09-20', description: 'Pix recebido' }),
      ];
      for (const movement of movements) await register(token, account.id, movement).expect(201);

      /** O pedido do saldo da conta, com a data dada. */
      const balance = (date?: string) =>
        authed(token, 'get', `/v1/accounts/${account.id}/balance`).query(date === undefined ? {} : { date });

      const expected: [string, string][] = [
        ['2026-09-01', '150.00'],
        ['2026-09-10', '119.75'],
        ['2026-09-19', '119.75'],
        ['2026-09-20', '129.75'],
      ];
      for (const [date, value] of expected) {
        expect((await balance(date).expect(200)).body as AccountBalance).toEqual({ date, balance: value });
      }

      expect((await balance().expect(200)).body as AccountBalance).toEqual({ date: '2026-09-15', balance: '119.75' });

      expect((await balance('2026-08-31').expect(422)).body).toMatchObject({ code: 'DATE_BEFORE_OPENING_BALANCE' });
      expect((await balance('31/08/2026').expect(400)).body).toMatchObject({
        code: 'INVALID_INPUT',
        fields: { date: expect.any(String) as string },
      });
    },
  );

  it(
    'lista as movimentações da mais recente para a mais antiga e a conta traz o saldo de hoje',
    { tags: ['@KAN-24-CA3'] },
    async () => {
      // Um dia depois de todas as movimentações, antes de abrir a sessão, que vence com o relógio.
      clock.set(new Date('2026-09-25T15:00:00Z'));
      const token = await newSession(app);
      const person = await newEntity(token);
      const account = await newAccount(token, person.id, '500.00', '2026-09-01');
      const untouched = await newAccount(token, person.id, '-20.50', '2026-09-01');
      // Fora da ordem das datas, para a lista provar que ordena pela data, e não pelo registro.
      const bodies: NewMovement[] = [
        movementBody({ direction: 'outflow', amount: '40.00', date: '2026-09-12', description: 'Padaria' }),
        movementBody({ direction: 'inflow', amount: '300.00', date: '2026-09-20', description: 'Salário' }),
        movementBody({ direction: 'outflow', amount: '15.90', date: '2026-09-05', description: 'Estacionamento' }),
        movementBody({ direction: 'outflow', amount: '120.00', date: '2026-09-20', description: 'Conta de luz' }),
        movementBody({ direction: 'outflow', amount: '9.10', date: '2026-09-12', description: 'Café' }),
      ];
      const created: Movement[] = [];
      for (const body of bodies) created.push((await register(token, account.id, body).expect(201)).body as Movement);
      const [bakery, salary, parking, power, coffee] = created;

      /** A página das movimentações da conta. */
      const pageOf = async (page: string) =>
        (await authed(token, 'get', `/v1/accounts/${account.id}/movements`).query({ page, pageSize: '2' }).expect(200))
          .body as MovementPage;

      expect(await pageOf('1')).toEqual({ items: [power, salary], total: 5, page: 1, pageSize: 2 });
      expect(await pageOf('2')).toEqual({ items: [coffee, bakery], total: 5, page: 2, pageSize: 2 });
      expect(await pageOf('3')).toEqual({ items: [parking], total: 5, page: 3, pageSize: 2 });

      // 500.00 + 300.00 - 40.00 - 15.90 - 120.00 - 9.10
      const balance = '615.00';
      const accounts = (
        (await authed(token, 'get', '/v1/accounts').set('Financial-Context', `entity:${person.id}`).expect(200))
          .body as { items: Account[] }
      ).items;
      expect(accounts.map(({ id, balance: value }) => ({ id, balance: value }))).toEqual(
        expect.arrayContaining([
          { id: account.id, balance },
          { id: untouched.id, balance: '-20.50' },
        ]),
      );
      expect(accounts).toHaveLength(2);
      expect((await authed(token, 'get', `/v1/accounts/${account.id}`).expect(200)).body).toMatchObject({ balance });
    },
  );

  it('o registro da movimentação fica na auditoria e no histórico da conta', { tags: ['@KAN-24-CA4'] }, async () => {
    clock.set(new Date());
    const token = await newSession(app);
    const session = (await getCurrentSession(app, token).expect(200)).body as {
      user: { id: string; name: string };
    };
    const user = { id: session.user.id, name: session.user.name };
    const person = await newEntity(token);
    const account = await newAccount(token, person.id, '100.00', '2026-09-01');
    const requestId = randomUUID();

    const movement = (
      await register(
        token,
        account.id,
        movementBody({ direction: 'inflow', amount: '50.25', date: '2026-09-03', description: 'Reembolso' }),
        requestId,
      ).expect(201)
    ).body as Movement;

    const audit = await app.get(PrismaService).auditLog.findMany({
      where: { tableName: 'movement', recordId: movement.id },
    });
    expect(audit.map(({ entityId, userId, requestId: id }) => ({ entityId, userId, requestId: id }))).toEqual([
      { entityId: person.id, userId: user.id, requestId },
    ]);

    const history = (await authed(token, 'get', `/v1/accounts/${account.id}/history`).expect(200)).body as {
      total: number;
      items: AuditHistoryEntry[];
    };
    expect(history.total).toBe(2);
    expect(history.items.map(({ tableName, recordId, action }) => ({ tableName, recordId, action }))).toEqual([
      { tableName: 'movement', recordId: movement.id, action: 'create' },
      { tableName: 'account', recordId: account.id, action: 'create' },
    ]);
    expect(history.items[0]).toEqual({
      id: expect.any(String) as string,
      occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
      user,
      action: 'create',
      tableName: 'movement',
      recordId: movement.id,
      subject: null,
      changes: [
        { field: 'date', before: null, after: '2026-09-03' },
        { field: 'description', before: null, after: 'Reembolso' },
        { field: 'amount', before: null, after: '50.25' },
        { field: 'direction', before: null, after: 'inflow' },
        { field: 'source', before: null, after: 'manual' },
      ],
    });

    // O id em maiúsculas é a mesma conta, e o histórico traz as movimentações dela do mesmo jeito.
    const upper = (await authed(token, 'get', `/v1/accounts/${account.id.toUpperCase()}/history`).expect(200)).body as {
      total: number;
    };
    expect(upper.total).toBe(2);

    const { token: stranger } = await newSessionByRoute(app, token);
    const refused = await authed(stranger, 'get', `/v1/accounts/${account.id}/history`).expect(403);
    expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});
