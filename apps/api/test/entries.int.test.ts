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

type EntryType = 'revenue' | 'expense';

/** Um lançamento, como o contrato o descreve. */
interface Entry {
  readonly id: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly type: EntryType;
  readonly description: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly categoryParentName: string | null;
  readonly purpose: 'personal' | 'household' | null;
  readonly occurredOn: string;
  readonly totalAmount: string;
  readonly installmentCount: number;
  readonly version: number;
}

/** Uma parcela, como o contrato a descreve. */
interface Installment {
  readonly id: string;
  readonly number: number;
  readonly dueDate: string;
  readonly amount: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly status: 'expected' | 'overdue';
}

/** Uma página, como o contrato a descreve. */
interface Page<T> {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly items: T[];
}

/** Uma parcela do mês, com o lançamento dela, como o contrato a descreve. */
interface EntryMonthItem {
  readonly entryId: string;
  readonly installmentId: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly type: EntryType;
  readonly description: string;
  readonly categoryName: string;
  readonly categoryParentName: string | null;
  readonly purpose: 'personal' | 'household' | null;
  readonly number: number;
  readonly installmentCount: number;
  readonly dueDate: string;
  readonly amount: string;
  readonly status: 'expected' | 'overdue';
}

/** Uma categoria da árvore, só com o que os testes dos lançamentos usam. */
interface CategoryTreeItem {
  readonly id: string;
  readonly monthTotal: string;
  readonly children: { readonly id: string; readonly monthTotal: string }[];
}

describe('Lançamentos', () => {
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
        .send({ type, name: uniqueName('Lançamento') })
        .expect(201)
    ).body as { id: string; name: string };
  }

  /** Cadastra uma conta corrente na entidade e a devolve. */
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
          openingBalanceDate: '2026-01-01',
        })
        .expect(201)
    ).body as { id: string; name: string; version: number };
  }

  /** Cria uma categoria e a devolve. */
  async function newCategory(token: string, body: { name: string; nature?: EntryType; parentId?: string }) {
    return (await authed(token, 'post', '/v1/categories').send(body).expect(201)).body as {
      id: string;
      name: string;
      version: number;
    };
  }

  /**
   * Um usuário novo com `operate` numa pessoa física com uma conta ativa e uma categoria de despesa e uma
   * de receita, de nomes únicos.
   */
  async function newOwner() {
    const token = await newSession(app);
    const person = await newEntity(token);
    const account = await newAccount(token, person.id);
    const prefix = uniquePrefix();
    const expense = await newCategory(token, { name: `${prefix} Casa`, nature: 'expense' });
    const revenue = await newCategory(token, { name: `${prefix} Salário`, nature: 'revenue' });
    return { token, person, account, expense, revenue, prefix };
  }

  /** O pedido de registrar um lançamento. */
  function create(token: string, body: Record<string, unknown>, requestId?: string) {
    return authed(token, 'post', '/v1/entries', requestId).send(body);
  }

  /** O corpo de uma despesa da pessoa, na conta e na categoria dadas, com o que mudar. */
  function expenseBody(
    owner: { person: { id: string }; account: { id: string }; expense: { id: string } },
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      entityId: owner.person.id,
      type: 'expense',
      description: uniqueName('Sofá'),
      categoryId: owner.expense.id,
      purpose: 'household',
      occurredOn: '2026-01-20',
      totalAmount: '100.00',
      installmentCount: 1,
      firstDueDate: '2026-01-31',
      accountId: owner.account.id,
      ...overrides,
    };
  }

  /** As parcelas do lançamento, todas numa página. */
  async function installmentsOf(token: string, entryId: string): Promise<Page<Installment>> {
    return (await authed(token, 'get', `/v1/entries/${entryId}/installments`).query({ pageSize: '100' }).expect(200))
      .body as Page<Installment>;
  }

  it(
    'registra a despesa parcelada e a receita à vista, com as parcelas mensais e os centavos na primeira',
    { tags: ['@KAN-28-CA1'] },
    async () => {
      clock.set(new Date('2026-01-15T12:00:00Z'));
      const owner = await newOwner();
      const { token, person, account, expense, revenue } = owner;

      const description = uniqueName('Geladeira');
      const created = (
        await create(
          token,
          expenseBody(owner, { description: `  ${description}  `, installmentCount: 3, totalAmount: '100' }),
        ).expect(201)
      ).body as Entry;
      expect(created).toEqual({
        id: expect.any(String) as string,
        entityId: person.id,
        entityName: person.name,
        type: 'expense',
        description,
        categoryId: expense.id,
        categoryName: expense.name,
        categoryParentName: null,
        purpose: 'household',
        occurredOn: '2026-01-20',
        totalAmount: '100.00',
        installmentCount: 3,
        version: 1,
      });
      expect((await authed(token, 'get', `/v1/entries/${created.id}`).expect(200)).body).toEqual(created);

      const parcels = { accountId: account.id, accountName: account.name, status: 'expected' };
      expect(await installmentsOf(token, created.id)).toEqual({
        total: 3,
        page: 1,
        pageSize: 100,
        items: [
          { ...parcels, id: expect.any(String) as string, number: 1, dueDate: '2026-01-31', amount: '33.34' },
          { ...parcels, id: expect.any(String) as string, number: 2, dueDate: '2026-02-28', amount: '33.33' },
          { ...parcels, id: expect.any(String) as string, number: 3, dueDate: '2026-03-31', amount: '33.33' },
        ],
      });

      const salary = (
        await create(token, {
          entityId: person.id,
          type: 'revenue',
          description: uniqueName('Salário'),
          categoryId: revenue.id,
          occurredOn: '2026-01-05',
          totalAmount: '1200.00',
          installmentCount: 1,
          firstDueDate: '2026-01-05',
          accountId: account.id,
        }).expect(201)
      ).body as Entry;
      expect(salary).toMatchObject({ type: 'revenue', purpose: null, totalAmount: '1200.00', installmentCount: 1 });
      expect((await installmentsOf(token, salary.id)).items).toEqual([
        {
          ...parcels,
          id: expect.any(String) as string,
          number: 1,
          dueDate: '2026-01-05',
          amount: '1200.00',
          status: 'overdue',
        },
      ]);
    },
  );

  it(
    'recusa a finalidade fora da regra, a categoria de outra natureza ou desativada e a entidade sem operate',
    { tags: ['@KAN-28-CA2'] },
    async () => {
      const owner = await newOwner();
      const { token, person, revenue, prefix } = owner;
      const description = uniqueName(`${prefix} Recusa`);
      const inactive = await newCategory(token, { name: `${prefix} Antiga`, nature: 'expense' });
      await authed(token, 'put', `/v1/categories/${inactive.id}/active`)
        .send({ active: false, version: inactive.version })
        .expect(200);

      const invalid: Record<string, unknown>[] = [
        expenseBody(owner, { description, purpose: undefined }),
        expenseBody(owner, { description, type: 'revenue', categoryId: revenue.id, purpose: 'personal' }),
      ];
      for (const body of invalid) {
        const response = await create(token, body).expect(400);
        expect(response.body).toMatchObject({
          code: 'INVALID_INPUT',
          fields: { purpose: expect.any(String) as string },
        });
      }

      const unprocessable: [Record<string, unknown>, string][] = [
        [expenseBody(owner, { description, categoryId: revenue.id }), 'CATEGORY_NATURE_MISMATCH'],
        [expenseBody(owner, { description, categoryId: inactive.id }), 'INACTIVE_CATEGORY'],
      ];
      for (const [body, code] of unprocessable) {
        const response = await create(token, body).expect(422);
        expect(response.body).toMatchObject({ code });
      }

      const { token: viewer } = await newSessionByRoute(app, token, {
        permissions: [{ entityId: person.id, level: 'view' }],
      });
      const forbidden = await create(viewer, expenseBody(owner, { description })).expect(403);
      expect(forbidden.body).toMatchObject({ code: 'FORBIDDEN' });

      const recorded = await app.get(PrismaService).entry.count({ where: { description } });
      expect(recorded).toBe(0);
    },
  );

  it('a criação do lançamento e das parcelas fica na auditoria', { tags: ['@KAN-28-CA4'] }, async () => {
    const owner = await newOwner();
    const { token, person } = owner;
    const session = (await getCurrentSession(app, token).expect(200)).body as { user: { id: string } };
    const requestId = randomUUID();

    const entry = (await create(token, expenseBody(owner, { installmentCount: 2 }), requestId).expect(201))
      .body as Entry;
    const installments = (await installmentsOf(token, entry.id)).items;

    const audit = await app.get(PrismaService).auditLog.findMany({
      where: { recordId: { in: [entry.id, ...installments.map((installment) => installment.id)] } },
      orderBy: { id: 'asc' },
    });
    const expected = { action: 'create', userId: session.user.id, requestId, entityId: person.id };
    expect(
      audit.map(({ action, tableName, recordId, userId, requestId, entityId }) => ({
        action,
        tableName,
        recordId,
        userId,
        requestId,
        entityId,
      })),
    ).toEqual([
      { ...expected, tableName: 'entry', recordId: entry.id },
      ...installments.map((installment) => ({ ...expected, tableName: 'installment', recordId: installment.id })),
    ]);
    expect(installments).toHaveLength(2);
  });

  /** A página da lista do mês, com o contexto da entidade. */
  async function monthOf(token: string, entityId: string, query: Record<string, string>) {
    return (
      await authed(token, 'get', '/v1/entries').set('Financial-Context', `entity:${entityId}`).query(query).expect(200)
    ).body as Page<EntryMonthItem>;
  }

  it(
    'lista as parcelas do mês do contexto, com o tipo, a busca, a página e a situação',
    { tags: ['@KAN-28-CA3'] },
    async () => {
      clock.set(new Date('2026-11-15T12:00:00Z'));
      const owner = await newOwner();
      const { token, person, account, revenue, prefix } = owner;

      // As despesas de novembro, uma por dia par; a do dia 14 é a parcela 2 da compra parcelada desde outubro.
      const days = [2, 4, 6, 8, 10, 12, 16, 18, 20, 22];
      for (const day of days) {
        const dueDate = `2026-11-${String(day).padStart(2, '0')}`;
        const description = day === 8 ? `${prefix} Pão de Açúcar` : `${prefix} Despesa ${String(day)}`;
        await create(token, expenseBody(owner, { description, firstDueDate: dueDate, occurredOn: dueDate })).expect(
          201,
        );
      }
      const notebook = (
        await create(
          token,
          expenseBody(owner, {
            description: `${prefix} Notebook`,
            occurredOn: '2026-10-01',
            totalAmount: '300.00',
            installmentCount: 3,
            firstDueDate: '2026-10-14',
          }),
        ).expect(201)
      ).body as Entry;
      const salary = (
        await create(token, {
          entityId: person.id,
          type: 'revenue',
          description: `${prefix} Salário`,
          categoryId: revenue.id,
          occurredOn: '2026-11-25',
          totalAmount: '5000.00',
          installmentCount: 1,
          firstDueDate: '2026-11-25',
          accountId: account.id,
        }).expect(201)
      ).body as Entry;
      await create(token, expenseBody(owner, { description: `${prefix} Dezembro`, firstDueDate: '2026-12-02' })).expect(
        201,
      );
      const other = await newEntity(token);
      const otherAccount = await newAccount(token, other.id);
      await create(token, {
        ...expenseBody(owner, { description: `${prefix} Outra pessoa`, firstDueDate: '2026-11-20' }),
        entityId: other.id,
        accountId: otherAccount.id,
      }).expect(201);

      const first = await monthOf(token, person.id, { month: '2026-11' });
      expect({ total: first.total, page: first.page, pageSize: first.pageSize }).toEqual({
        total: 12,
        page: 1,
        pageSize: 10,
      });
      expect(first.items.map((item) => item.dueDate)).toEqual([
        '2026-11-25',
        '2026-11-22',
        '2026-11-20',
        '2026-11-18',
        '2026-11-16',
        '2026-11-14',
        '2026-11-12',
        '2026-11-10',
        '2026-11-08',
        '2026-11-06',
      ]);
      const second = await monthOf(token, person.id, { month: '2026-11', page: '2' });
      expect(second.items.map((item) => item.dueDate)).toEqual(['2026-11-04', '2026-11-02']);

      expect(first.items[0]).toEqual({
        entryId: salary.id,
        installmentId: expect.any(String) as string,
        entityId: person.id,
        entityName: person.name,
        type: 'revenue',
        description: `${prefix} Salário`,
        categoryName: revenue.name,
        categoryParentName: null,
        purpose: null,
        number: 1,
        installmentCount: 1,
        dueDate: '2026-11-25',
        amount: '5000.00',
        status: 'expected',
      });
      expect(first.items[4]).toMatchObject({ dueDate: '2026-11-16', status: 'expected' });
      expect(first.items[5]).toMatchObject({
        entryId: notebook.id,
        description: `${prefix} Notebook`,
        number: 2,
        installmentCount: 3,
        amount: '100.00',
        purpose: 'household',
        status: 'overdue',
      });

      const revenues = await monthOf(token, person.id, { month: '2026-11', type: 'revenue' });
      expect(revenues.items.map((item) => item.entryId)).toEqual([salary.id]);
      const found = await monthOf(token, person.id, { month: '2026-11', q: 'acucar' });
      expect(found.items.map((item) => item.description)).toEqual([`${prefix} Pão de Açúcar`]);
    },
  );

  it(
    'a árvore traz o total do mês de cada categoria, com o pai somando as subcategorias',
    { tags: ['@KAN-28-CA6'] },
    async () => {
      const owner = await newOwner();
      const { token, prefix } = owner;
      const parent = await newCategory(token, { name: `${prefix} Moradia`, nature: 'expense' });
      const child = await newCategory(token, { name: `${prefix} Energia`, parentId: parent.id });
      const expense = (overrides: Record<string, unknown>) => create(token, expenseBody(owner, overrides)).expect(201);
      await expense({ categoryId: parent.id, totalAmount: '100.00', firstDueDate: '2026-11-05' });
      await expense({ categoryId: child.id, totalAmount: '50.25', firstDueDate: '2026-11-30' });
      await expense({ categoryId: child.id, totalAmount: '70.00', firstDueDate: '2026-12-01' });

      // Outra pessoa física, em que o usuário do teste não tem permissão, com uma despesa de novembro.
      const stranger = await newOwner();
      await create(
        stranger.token,
        expenseBody(stranger, { categoryId: child.id, totalAmount: '999.00', firstDueDate: '2026-11-10' }),
      ).expect(201);

      /** A categoria de primeiro nível do teste na árvore de despesa do mês. */
      async function treeIn(month: string): Promise<CategoryTreeItem | undefined> {
        const page = (
          await authed(token, 'get', '/v1/categories').query({ nature: 'expense', q: prefix, month }).expect(200)
        ).body as Page<CategoryTreeItem>;
        return page.items.find((item) => item.id === parent.id);
      }

      expect(await treeIn('2026-11')).toMatchObject({
        monthTotal: '150.25',
        children: [{ id: child.id, monthTotal: '50.25' }],
      });
      expect(await treeIn('2026-12')).toMatchObject({
        monthTotal: '70.00',
        children: [{ id: child.id, monthTotal: '70.00' }],
      });
    },
  );
});
