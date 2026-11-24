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

/** Uma entidade, só com o que os testes do ajuste usam. */
interface Entity {
  readonly id: string;
}

/** Uma conta, só com o que os testes do ajuste usam. */
interface Account {
  readonly id: string;
  readonly version: number;
}

/** Uma movimentação, como o contrato a descreve. */
interface Movement {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly amount: string;
  readonly direction: 'inflow' | 'outflow';
  readonly source: 'manual' | 'adjustment';
}

/** Uma alteração do histórico, só com o que o teste do ajuste lê. */
interface AuditHistoryEntry {
  readonly action: 'create' | 'update' | 'delete';
  readonly tableName: string;
  readonly recordId: string;
}

/** O corpo do ajuste. */
interface NewAdjustment {
  readonly date: string;
  readonly bankBalance: string;
  readonly reason: string;
}

describe('Ajuste do saldo', () => {
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
  async function newEntity(token: string) {
    return (
      await authed(token, 'post', '/v1/entities')
        .send({ type: 'individual', name: uniqueName('Ajuste') })
        .expect(201)
    ).body as Entity;
  }

  /** Cadastra uma conta corrente na entidade, com o saldo inicial dado em 2026-09-01, e a devolve. */
  async function newAccount(token: string, entityId: string, openingBalance = '100.00') {
    return (
      await authed(token, 'post', '/v1/accounts')
        .send({
          entityId,
          name: uniqueName('Nubank'),
          type: 'checking',
          institution: 'nubank',
          isReserve: false,
          openingBalance,
          openingBalanceDate: '2026-09-01',
        })
        .expect(201)
    ).body as Account;
  }

  /** O pedido de ajustar o saldo da conta. */
  function adjust(token: string, accountId: string, body: object, requestId?: string) {
    return authed(token, 'post', `/v1/accounts/${accountId}/adjustments`, requestId).send(body);
  }

  /** As movimentações da conta, na primeira página. */
  async function movementsOf(token: string, accountId: string) {
    return (
      (await authed(token, 'get', `/v1/accounts/${accountId}/movements`).expect(200)).body as {
        items: Movement[];
      }
    ).items;
  }

  /** O saldo da conta no fim do dia. */
  async function balanceOn(token: string, accountId: string, date: string) {
    return (
      (await authed(token, 'get', `/v1/accounts/${accountId}/balance`).query({ date }).expect(200)).body as {
        balance: string;
      }
    ).balance;
  }

  it(
    'o ajuste grava a diferença para o saldo do banco, e o saldo passa a bater',
    { tags: ['@KAN-25-CA1'] },
    async () => {
      clock.set(new Date());
      const token = await newSession(app);
      const person = await newEntity(token);
      const account = await newAccount(token, person.id, '100.00');
      await authed(token, 'post', `/v1/accounts/${account.id}/movements`)
        .send({ direction: 'outflow', date: '2026-09-10', amount: '30.00', description: 'Mercado' })
        .expect(201);

      const outflow = (
        await adjust(token, account.id, {
          date: '2026-09-10',
          bankBalance: '50.00',
          reason: '  Tarifa não lançada  ',
        }).expect(201)
      ).body as Movement;

      expect(outflow).toEqual({
        id: expect.any(String) as string,
        date: '2026-09-10',
        description: 'Tarifa não lançada',
        amount: '20.00',
        direction: 'outflow',
        source: 'adjustment',
      });
      expect(await balanceOn(token, account.id, '2026-09-10')).toBe('50.00');
      expect(await balanceOn(token, account.id, '2026-09-09')).toBe('100.00');

      const inflow = (
        await adjust(token, account.id, { date: '2026-09-20', bankBalance: '80.00', reason: 'Pix não lançado' }).expect(
          201,
        )
      ).body as Movement;

      expect(inflow).toMatchObject({ date: '2026-09-20', amount: '30.00', direction: 'inflow', source: 'adjustment' });
      expect(await balanceOn(token, account.id, '2026-09-20')).toBe('80.00');

      const negative = (
        await adjust(token, account.id, {
          date: '2026-09-20',
          bankBalance: '-10.00',
          reason: 'Cheque especial',
        }).expect(201)
      ).body as Movement;

      expect(negative).toMatchObject({ amount: '90.00', direction: 'outflow', source: 'adjustment' });
      expect(await balanceOn(token, account.id, '2026-09-20')).toBe('-10.00');
    },
  );

  it(
    'o ajuste sem motivo, igual ao saldo calculado ou antes do saldo inicial é recusado',
    { tags: ['@KAN-25-CA2'] },
    async () => {
      clock.set(new Date());
      const owner = await newSession(app);
      const viewed = await newEntity(owner);
      const viewedAccount = await newAccount(owner, viewed.id);
      const { token } = await newSessionByRoute(app, owner, {
        permissions: [{ entityId: viewed.id, level: 'view' }],
      });
      const person = await newEntity(token);
      const account = await newAccount(token, person.id, '100.00');
      const body: NewAdjustment = { date: '2026-09-10', bankBalance: '90.00', reason: 'Tarifa não lançada' };

      for (const reason of [undefined, '   ']) {
        const response = await adjust(token, account.id, { ...body, reason }).expect(400);
        expect(response.body).toMatchObject({
          code: 'INVALID_INPUT',
          fields: { reason: expect.any(String) as string },
        });
      }
      expect((await adjust(token, account.id, { ...body, bankBalance: '100.00' }).expect(422)).body).toMatchObject({
        code: 'BALANCE_ALREADY_MATCHES',
      });
      // O saldo do banco é válido, mas a diferença para o calculado passa do limite do valor de uma movimentação.
      expect(
        (await adjust(token, account.id, { ...body, bankBalance: '-9999999999999.99' }).expect(400)).body,
      ).toMatchObject({ code: 'INVALID_INPUT', fields: { bankBalance: expect.any(String) as string } });
      expect((await adjust(token, account.id, { ...body, date: '2026-08-31' }).expect(422)).body).toMatchObject({
        code: 'DATE_BEFORE_OPENING_BALANCE',
      });
      expect(await movementsOf(token, account.id)).toEqual([]);

      expect((await adjust(token, viewedAccount.id, body).expect(403)).body).toMatchObject({ code: 'FORBIDDEN' });

      await authed(token, 'put', `/v1/accounts/${account.id}/active`)
        .send({ active: false, version: account.version })
        .expect(200);
      expect((await adjust(token, account.id, body).expect(422)).body).toMatchObject({ code: 'INACTIVE_ACCOUNT' });
      expect(await movementsOf(token, account.id)).toEqual([]);
    },
  );

  it('o ajuste fica na auditoria, com o motivo, e no histórico da conta', { tags: ['@KAN-25-CA3'] }, async () => {
    clock.set(new Date());
    const token = await newSession(app);
    const session = (await getCurrentSession(app, token).expect(200)).body as { user: { id: string; name: string } };
    const user = { id: session.user.id, name: session.user.name };
    const person = await newEntity(token);
    const account = await newAccount(token, person.id, '100.00');
    const requestId = randomUUID();

    const adjustment = (
      await adjust(
        token,
        account.id,
        { date: '2026-09-05', bankBalance: '87.15', reason: 'Tarifa não lançada' },
        requestId,
      ).expect(201)
    ).body as Movement;

    const audit = await app.get(PrismaService).auditLog.findMany({
      where: { tableName: 'movement', recordId: adjustment.id },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'create',
      entityId: person.id,
      userId: user.id,
      requestId,
      after: expect.objectContaining({ source: 'adjustment', description: 'Tarifa não lançada' }) as unknown,
    });

    const history = (await authed(token, 'get', `/v1/accounts/${account.id}/history`).expect(200)).body as {
      items: AuditHistoryEntry[];
    };
    expect(history.items.map(({ tableName, recordId, action }) => ({ tableName, recordId, action }))).toEqual([
      { tableName: 'movement', recordId: adjustment.id, action: 'create' },
      { tableName: 'account', recordId: account.id, action: 'create' },
    ]);
    expect(history.items[0]).toMatchObject({
      user,
      changes: [
        { field: 'date', before: null, after: '2026-09-05' },
        { field: 'description', before: null, after: 'Tarifa não lançada' },
        { field: 'amount', before: null, after: '12.85' },
        { field: 'direction', before: null, after: 'outflow' },
        { field: 'source', before: null, after: 'adjustment' },
      ],
    });
  });
});
