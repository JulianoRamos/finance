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

/** Um lançamento, só com o que os testes dos pagamentos usam. */
interface Entry {
  readonly id: string;
  readonly description: string;
}

/** Uma parcela, só com o que os testes dos pagamentos usam. */
interface Installment {
  readonly id: string;
  readonly number: number;
  readonly amount: string;
  readonly status: 'expected' | 'overdue' | 'settled';
}

/** Um pagamento de parcela, como o contrato o descreve. */
interface InstallmentPayment {
  readonly id: string;
  readonly installmentId: string;
  readonly installmentNumber: number;
  readonly movementId: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly date: string;
  readonly amount: string;
}

/** Uma movimentação, só com o que os testes dos pagamentos usam. */
interface Movement {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly amount: string;
  readonly direction: 'inflow' | 'outflow';
  readonly source: string;
}

/** Uma página, como o contrato a descreve. */
interface Page<T> {
  readonly total: number;
  readonly items: T[];
}

describe('Pagamentos das parcelas', () => {
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

  /** Cadastra uma conta corrente na entidade, de saldo inicial zero em 01/11/2026, e a devolve. */
  async function newAccount(token: string, entityId: string) {
    return (
      await authed(token, 'post', '/v1/accounts')
        .send({
          entityId,
          name: uniqueName('Nubank'),
          type: 'checking',
          institution: 'nubank',
          isReserve: false,
          openingBalance: '0.00',
          openingBalanceDate: '2026-11-01',
        })
        .expect(201)
    ).body as { id: string; name: string; version: number };
  }

  /**
   * Um usuário novo com `operate` numa pessoa física com duas contas ativas e uma categoria de despesa e
   * uma de receita, de nomes únicos.
   */
  async function newOwner() {
    const token = await newSession(app);
    const person = (
      await authed(token, 'post', '/v1/entities')
        .send({ type: 'individual', name: uniqueName('Pagamento') })
        .expect(201)
    ).body as { id: string; name: string };
    const account = await newAccount(token, person.id);
    const other = await newAccount(token, person.id);
    const prefix = uniquePrefix();
    const category = async (name: string, nature: 'expense' | 'revenue') =>
      (await authed(token, 'post', '/v1/categories').send({ name, nature }).expect(201)).body as { id: string };
    const expense = await category(`${prefix} Casa`, 'expense');
    const revenue = await category(`${prefix} Salário`, 'revenue');
    return { token, person, account, other, expense, revenue };
  }

  type Owner = Awaited<ReturnType<typeof newOwner>>;

  /** O corpo de uma despesa da pessoa, na primeira conta, com o que mudar. */
  function expenseBody(owner: Owner, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      entityId: owner.person.id,
      type: 'expense',
      description: uniqueName('Sofá'),
      categoryId: owner.expense.id,
      purpose: 'household',
      occurredOn: '2026-11-01',
      totalAmount: '100.00',
      installmentCount: 1,
      firstDueDate: '2026-11-05',
      accountId: owner.account.id,
      ...overrides,
    };
  }

  /** As parcelas do lançamento, todas numa página. */
  async function installmentsOf(token: string, entryId: string): Promise<Installment[]> {
    return (
      (await authed(token, 'get', `/v1/entries/${entryId}/installments`).query({ pageSize: '100' }).expect(200))
        .body as Page<Installment>
    ).items;
  }

  /** Os pagamentos das parcelas do lançamento, todos numa página. */
  async function paymentsOf(token: string, entryId: string): Promise<InstallmentPayment[]> {
    return (
      (await authed(token, 'get', '/v1/installment-payments').query({ entryId, pageSize: '100' }).expect(200))
        .body as Page<InstallmentPayment>
    ).items;
  }

  /** As movimentações da conta, todas numa página. */
  async function movementsOf(token: string, accountId: string): Promise<Movement[]> {
    return (
      (await authed(token, 'get', `/v1/accounts/${accountId}/movements`).query({ pageSize: '100' }).expect(200))
        .body as Page<Movement>
    ).items;
  }

  /** O saldo da conta no fim do dia dado. */
  async function balanceOf(token: string, accountId: string, date: string): Promise<string> {
    return (
      (await authed(token, 'get', `/v1/accounts/${accountId}/balance`).query({ date }).expect(200)).body as {
        balance: string;
      }
    ).balance;
  }

  it(
    'o já pago cria o lançamento com a primeira parcela paga, a movimentação e a conciliação',
    { tags: ['@KAN-29-CA1'] },
    async () => {
      clock.set(new Date('2026-11-15T12:00:00Z'));
      const owner = await newOwner();
      const { token, person, account, other, revenue } = owner;

      const salaryDescription = uniqueName('Salário');
      const salary = (
        await authed(token, 'post', '/v1/paid-entries')
          .send({
            entityId: person.id,
            type: 'revenue',
            description: salaryDescription,
            categoryId: revenue.id,
            occurredOn: '2026-11-10',
            totalAmount: '1200.00',
            installmentCount: 1,
            firstDueDate: '2026-11-10',
            accountId: account.id,
            paymentAccountId: other.id,
            paymentDate: '2026-11-10',
          })
          .expect(201)
      ).body as Entry;
      expect(salary).toMatchObject({ description: salaryDescription, totalAmount: '1200.00', installmentCount: 1 });

      const [single] = await installmentsOf(token, salary.id);
      expect(single).toMatchObject({ number: 1, amount: '1200.00', status: 'settled' });
      const payments = await paymentsOf(token, salary.id);
      expect(payments).toEqual([
        {
          id: expect.any(String) as string,
          installmentId: single?.id,
          installmentNumber: 1,
          movementId: expect.any(String) as string,
          accountId: other.id,
          accountName: other.name,
          date: '2026-11-10',
          amount: '1200.00',
        },
      ]);
      expect(await movementsOf(token, other.id)).toEqual([
        {
          id: payments[0]?.movementId,
          date: '2026-11-10',
          description: salaryDescription,
          amount: '1200.00',
          direction: 'inflow',
          source: 'manual',
        },
      ]);
      expect(await balanceOf(token, other.id, '2026-11-15')).toBe('1200.00');

      const sofaDescription = uniqueName('Sofá');
      const sofa = (
        await authed(token, 'post', '/v1/paid-entries')
          .send({
            ...expenseBody(owner, { description: sofaDescription, installmentCount: 3 }),
            paymentAccountId: account.id,
            paymentDate: '2026-11-12',
          })
          .expect(201)
      ).body as Entry;
      expect(
        (await installmentsOf(token, sofa.id)).map(({ number, amount, status }) => ({ number, amount, status })),
      ).toEqual([
        { number: 1, amount: '33.34', status: 'settled' },
        { number: 2, amount: '33.33', status: 'expected' },
        { number: 3, amount: '33.33', status: 'expected' },
      ]);
      expect(await movementsOf(token, account.id)).toMatchObject([
        {
          date: '2026-11-12',
          description: `${sofaDescription} (parcela 1 de 3)`,
          amount: '33.34',
          direction: 'outflow',
        },
      ]);
      expect(await balanceOf(token, account.id, '2026-11-15')).toBe('-33.34');
    },
  );

  /** O pedido de pagar uma parcela. */
  function pay(token: string, body: Record<string, unknown>, requestId?: string) {
    return authed(token, 'post', '/v1/installment-payments', requestId).send(body);
  }

  it('paga uma parcela em aberto e desfaz o pagamento, com o saldo de antes', { tags: ['@KAN-29-CA2'] }, async () => {
    clock.set(new Date('2026-11-15T12:00:00Z'));
    const owner = await newOwner();
    const { token, account } = owner;
    const entry = (
      await authed(token, 'post', '/v1/entries')
        .send(expenseBody(owner, { totalAmount: '300.00', installmentCount: 3, firstDueDate: '2026-11-05' }))
        .expect(201)
    ).body as Entry;
    const [first] = await installmentsOf(token, entry.id);
    expect(first).toMatchObject({ number: 1, status: 'overdue' });

    const payment = (
      await pay(token, { installmentId: first?.id, accountId: account.id, date: '2026-11-14' }).expect(201)
    ).body as InstallmentPayment;
    expect(payment).toEqual({
      id: expect.any(String) as string,
      installmentId: first?.id,
      installmentNumber: 1,
      movementId: expect.any(String) as string,
      accountId: account.id,
      accountName: account.name,
      date: '2026-11-14',
      amount: '100.00',
    });
    expect((await installmentsOf(token, entry.id))[0]).toMatchObject({ number: 1, status: 'settled' });
    expect(await balanceOf(token, account.id, '2026-11-15')).toBe('-100.00');

    await authed(token, 'delete', `/v1/installment-payments/${payment.id}`).expect(204);

    expect(await paymentsOf(token, entry.id)).toEqual([]);
    expect(await movementsOf(token, account.id)).toEqual([]);
    expect((await installmentsOf(token, entry.id))[0]).toMatchObject({ number: 1, status: 'overdue' });
    expect(await balanceOf(token, account.id, '2026-11-15')).toBe('0.00');
  });

  it('recusa pagar a parcela já paga e pagar numa conta desativada', { tags: ['@KAN-29-CA3'] }, async () => {
    clock.set(new Date('2026-11-15T12:00:00Z'));
    const owner = await newOwner();
    const { token, account, other } = owner;
    const entry = (
      await authed(token, 'post', '/v1/entries')
        .send(expenseBody(owner, { totalAmount: '200.00', installmentCount: 2 }))
        .expect(201)
    ).body as Entry;
    const [first, second] = await installmentsOf(token, entry.id);
    await pay(token, { installmentId: first?.id, accountId: account.id, date: '2026-11-05' }).expect(201);
    await authed(token, 'put', `/v1/accounts/${other.id}/active`)
      .send({ active: false, version: other.version })
      .expect(200);

    const again = await pay(token, { installmentId: first?.id, accountId: account.id, date: '2026-11-06' }).expect(422);
    expect(again.body).toMatchObject({ code: 'INSTALLMENT_ALREADY_SETTLED' });
    const inactive = await pay(token, { installmentId: second?.id, accountId: other.id, date: '2026-11-06' }).expect(
      422,
    );
    expect(inactive.body).toMatchObject({ code: 'INACTIVE_ACCOUNT' });
    const description = uniqueName('Recusa');
    const paidEntry = await authed(token, 'post', '/v1/paid-entries')
      .send({ ...expenseBody(owner, { description }), paymentAccountId: other.id, paymentDate: '2026-11-06' })
      .expect(422);
    expect(paidEntry.body).toMatchObject({ code: 'INACTIVE_PAYMENT_ACCOUNT' });

    expect((await paymentsOf(token, entry.id)).map((payment) => payment.installmentNumber)).toEqual([1]);
    expect(await movementsOf(token, account.id)).toHaveLength(1);
    expect(await movementsOf(token, other.id)).toEqual([]);
    expect((await installmentsOf(token, entry.id))[1]).toMatchObject({ number: 2, status: 'expected' });
    const recorded = await app.get(PrismaService).entry.count({ where: { description } });
    expect(recorded).toBe(0);
  });

  it('o pagamento e o desfazer ficam na auditoria', { tags: ['@KAN-29-CA4'] }, async () => {
    clock.set(new Date('2026-11-15T12:00:00Z'));
    const owner = await newOwner();
    const { token, person, account } = owner;
    const session = (await getCurrentSession(app, token).expect(200)).body as { user: { id: string } };
    const entry = (await authed(token, 'post', '/v1/entries').send(expenseBody(owner)).expect(201)).body as Entry;
    const [installment] = await installmentsOf(token, entry.id);
    const payRequest = randomUUID();
    const undoRequest = randomUUID();

    const payment = (
      await pay(
        token,
        { installmentId: installment?.id, accountId: account.id, date: '2026-11-05' },
        payRequest,
      ).expect(201)
    ).body as InstallmentPayment;
    await authed(token, 'delete', `/v1/installment-payments/${payment.id}`, undoRequest).expect(204);

    const audit = await app.get(PrismaService).auditLog.findMany({
      where: { recordId: { in: [payment.id, payment.movementId, installment?.id ?? ''] }, action: { not: 'create' } },
      orderBy: { id: 'asc' },
    });
    const created = await app.get(PrismaService).auditLog.findMany({
      where: { recordId: { in: [payment.id, payment.movementId] }, action: 'create' },
      orderBy: { id: 'asc' },
    });
    const shape = ({ action, tableName, recordId, userId, requestId, entityId }: (typeof audit)[number]) => ({
      action,
      tableName,
      recordId,
      userId,
      requestId,
      entityId,
    });
    const by = { userId: session.user.id, entityId: person.id };
    expect([...created, ...audit].map(shape)).toEqual([
      { ...by, requestId: payRequest, action: 'create', tableName: 'movement', recordId: payment.movementId },
      { ...by, requestId: payRequest, action: 'create', tableName: 'reconciliation', recordId: payment.id },
      { ...by, requestId: payRequest, action: 'update', tableName: 'installment', recordId: installment?.id },
      { ...by, requestId: undoRequest, action: 'delete', tableName: 'reconciliation', recordId: payment.id },
      { ...by, requestId: undoRequest, action: 'delete', tableName: 'movement', recordId: payment.movementId },
      { ...by, requestId: undoRequest, action: 'update', tableName: 'installment', recordId: installment?.id },
    ]);
    const installmentUpdates = audit.filter((row) => row.tableName === 'installment');
    expect(installmentUpdates.map((row) => [row.before, row.after])).toEqual([
      // A auditoria grava o decimal sem os zeros das casas (LLD, seção 4.4).
      [expect.objectContaining({ reconciledAmount: '0' }), expect.objectContaining({ reconciledAmount: '100' })],
      [expect.objectContaining({ reconciledAmount: '100' }), expect.objectContaining({ reconciledAmount: '0' })],
    ]);
  });
});
