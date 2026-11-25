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

type Nature = 'revenue' | 'expense';

/** Uma categoria, como o contrato a descreve. */
interface Category {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly nature: Nature;
  readonly active: boolean;
  readonly version: number;
}

/** Uma subcategoria na árvore, como o contrato a descreve. */
interface CategoryTreeChild extends Category {
  readonly matched: boolean;
  readonly monthTotal: string;
}

/** Uma categoria de primeiro nível na árvore, com as subcategorias. */
interface CategoryTreeItem extends CategoryTreeChild {
  readonly children: CategoryTreeChild[];
}

/** Uma página da árvore, como o contrato a descreve. */
interface CategoryTreePage {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly items: CategoryTreeItem[];
}

/** As categorias de primeiro nível que a migração semeia (LLD, seção 4.6). */
const SEEDED: Record<Nature, readonly string[]> = {
  expense: [
    'Moradia',
    'Alimentação',
    'Transporte',
    'Saúde',
    'Educação',
    'Lazer',
    'Vestuário',
    'Serviços e assinaturas',
    'Impostos e taxas',
    'Despesas financeiras',
    'Outras',
  ],
  revenue: ['Salário', 'Pró-labore', 'Distribuição de lucros', 'Rendimentos', 'Outras'],
};

describe('Categorias', () => {
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
  async function newEntity(token: string, type: 'individual' | 'company') {
    return (
      await authed(token, 'post', '/v1/entities')
        .send({ type, name: uniqueName('Categoria') })
        .expect(201)
    ).body as { id: string };
  }

  /** Um usuário novo com `operate` numa pessoa física, e o token dele. */
  async function newOperator(): Promise<string> {
    const token = await newSession(app);
    await newEntity(token, 'individual');
    return token;
  }

  /** O pedido de criar uma categoria. */
  function create(token: string, body: unknown, requestId?: string) {
    return authed(token, 'post', '/v1/categories', requestId).send(body as object);
  }

  /** Cria uma categoria e a devolve. */
  async function newCategory(token: string, body: { name: string; nature?: Nature; parentId?: string }) {
    return (await create(token, body).expect(201)).body as Category;
  }

  /** O pedido de editar uma categoria. */
  function edit(token: string, id: string, body: unknown, requestId?: string) {
    return authed(token, 'put', `/v1/categories/${id}`, requestId).send(body as object);
  }

  /** O pedido de desativar ou reativar uma categoria. */
  function setActive(token: string, category: Category, active: boolean, requestId?: string) {
    return authed(token, 'put', `/v1/categories/${category.id}/active`, requestId).send({
      active,
      version: category.version,
    });
  }

  /** O pedido da lista da árvore. */
  function list(token: string, query: Record<string, string>) {
    return authed(token, 'get', '/v1/categories').query(query);
  }

  /** A página da árvore, que responde 200. */
  async function treeOf(token: string, query: Record<string, string>): Promise<CategoryTreePage> {
    return (await list(token, query).expect(200)).body as CategoryTreePage;
  }

  /** As categorias de primeiro nível da natureza, de todas as páginas. */
  async function wholeTree(token: string, nature: Nature): Promise<CategoryTreeItem[]> {
    const first = await treeOf(token, { nature, pageSize: '100' });
    const items = [...first.items];
    for (let page = 2; items.length < first.total; page++) {
      items.push(...(await treeOf(token, { nature, pageSize: '100', page: String(page) })).items);
    }
    return items;
  }

  it(
    'a árvore nasce com o primeiro nível do LLD e recebe categoria e subcategoria',
    { tags: ['@KAN-27-CA1'] },
    async () => {
      const token = await newOperator();

      for (const nature of ['expense', 'revenue'] as const) {
        const tree = await wholeTree(token, nature);
        for (const name of SEEDED[nature]) {
          expect(tree).toContainEqual(
            expect.objectContaining({ name, nature, parentId: null, active: true, matched: true }),
          );
        }
      }

      const prefix = uniquePrefix();
      const parent = await newCategory(token, { name: `${prefix} Casa`, nature: 'expense' });
      expect(parent).toEqual({
        id: expect.any(String) as string,
        parentId: null,
        name: `${prefix} Casa`,
        nature: 'expense',
        active: true,
        version: 1,
      });
      const child = await newCategory(token, { name: `  ${prefix} Energia  `, parentId: parent.id });
      expect(child).toEqual({
        id: expect.any(String) as string,
        parentId: parent.id,
        name: `${prefix} Energia`,
        nature: 'expense',
        active: true,
        version: 1,
      });

      // O prefixo é o começo do nome das duas, então a busca traz a categoria e a subcategoria.
      const found = await treeOf(token, { nature: 'expense', q: prefix });
      expect(found).toEqual({
        total: 1,
        page: 1,
        pageSize: 10,
        items: [
          { ...parent, matched: true, monthTotal: '0.00', children: [{ ...child, matched: true, monthTotal: '0.00' }] },
        ],
      });

      for (const body of [{ name: `${prefix} Sem natureza` }, { name: `${prefix} Sem natureza`, parentId: null }]) {
        const refused = await create(token, body).expect(400);
        expect(refused.body).toMatchObject({ code: 'INVALID_INPUT', fields: { nature: expect.any(String) as string } });
      }
    },
  );

  it(
    'renomeia e muda o pai na mesma natureza, e recusa a natureza nova e o pai de outra natureza',
    { tags: ['@KAN-27-CA2'] },
    async () => {
      const token = await newOperator();
      const prefix = uniquePrefix();
      const a = await newCategory(token, { name: `${prefix} A`, nature: 'expense' });
      const s = await newCategory(token, { name: `${prefix} S`, parentId: a.id });
      const b = await newCategory(token, { name: `${prefix} B`, nature: 'expense' });
      const r = await newCategory(token, { name: `${prefix} R`, nature: 'revenue' });
      const other = await newCategory(token, { name: `${prefix} Outra`, nature: 'expense' });

      const moved = (
        await edit(token, s.id, { version: 1, name: `${prefix} S2`, parentId: b.id, nature: 'expense' }).expect(200)
      ).body as Category;
      expect(moved).toEqual({ ...s, name: `${prefix} S2`, parentId: b.id, version: 2 });

      const refusals: [Record<string, unknown>, number, string][] = [
        [{ nature: 'revenue' }, 422, 'CATEGORY_NATURE_IMMUTABLE'],
        [{ parentId: r.id }, 422, 'PARENT_NATURE_MISMATCH'],
        [{ version: 1 }, 409, 'VERSION_CONFLICT'],
      ];
      for (const [overrides, status, code] of refusals) {
        const body = { version: 2, name: moved.name, parentId: b.id, nature: 'expense', ...overrides };
        const response = await edit(token, s.id, body).expect(status);
        expect(response.body).toMatchObject({ code });
      }
      const tooDeep = await edit(token, other.id, {
        version: 1,
        name: other.name,
        parentId: s.id,
        nature: 'expense',
      }).expect(422);
      expect(tooDeep.body).toMatchObject({ code: 'CATEGORY_TOO_DEEP' });

      const owner = await newSession(app);
      const person = await newEntity(owner, 'individual');
      const { token: viewer } = await newSessionByRoute(app, owner, {
        permissions: [{ entityId: person.id, level: 'view' }],
      });
      const forbidden = await edit(viewer, s.id, {
        version: 2,
        name: uniqueName('Outro nome'),
        parentId: b.id,
        nature: 'expense',
      }).expect(403);
      expect(forbidden.body).toMatchObject({ code: 'FORBIDDEN' });
    },
  );

  it(
    'a categoria desativada some das escolhas e volta ao ser reativada, e as alterações ficam na auditoria',
    { tags: ['@KAN-27-CA3'] },
    async () => {
      const token = await newOperator();
      const session = (await getCurrentSession(app, token).expect(200)).body as { user: { id: string } };
      const prefix = uniquePrefix();
      const requestId = randomUUID();
      const parent = (await create(token, { name: `${prefix} Casa`, nature: 'expense' }, requestId).expect(201))
        .body as Category;
      const child = (await create(token, { name: `${prefix} Luz`, parentId: parent.id }, requestId).expect(201))
        .body as Category;

      const deactivated = (await setActive(token, parent, false, requestId).expect(200)).body as Category;
      expect(deactivated).toEqual({ ...parent, active: false, version: 2 });

      const chosen = await treeOf(token, { nature: 'expense', q: prefix, active: 'true' });
      expect(chosen.items).toEqual([]);
      const all = await treeOf(token, { nature: 'expense', q: prefix });
      expect(all.items).toEqual([
        {
          ...deactivated,
          matched: true,
          monthTotal: '0.00',
          children: [{ ...child, active: false, version: 2, matched: true, monthTotal: '0.00' }],
        },
      ]);

      const refused = await setActive(token, { ...child, active: false, version: 2 }, true, requestId).expect(422);
      expect(refused.body).toMatchObject({ code: 'INACTIVE_PARENT' });

      const reactivated = (await setActive(token, deactivated, true, requestId).expect(200)).body as Category;
      expect(reactivated).toEqual({ ...parent, active: true, version: 3 });
      const chosenAgain = await treeOf(token, { nature: 'expense', q: prefix, active: 'true' });
      expect(chosenAgain.items).toEqual([{ ...reactivated, matched: true, monthTotal: '0.00', children: [] }]);

      const audit = await app.get(PrismaService).auditLog.findMany({
        where: { tableName: 'category', recordId: { in: [parent.id, child.id] } },
        orderBy: { id: 'asc' },
      });
      const expected = { tableName: 'category', userId: session.user.id, requestId, entityId: null };
      expect(
        audit.map(({ action, recordId, tableName, userId, requestId, entityId }) => ({
          action,
          recordId,
          tableName,
          userId,
          requestId,
          entityId,
        })),
      ).toEqual([
        { ...expected, action: 'create', recordId: parent.id },
        { ...expected, action: 'create', recordId: child.id },
        { ...expected, action: 'update', recordId: parent.id },
        { ...expected, action: 'update', recordId: child.id },
        { ...expected, action: 'update', recordId: parent.id },
      ]);
    },
  );

  it(
    'a pesquisa traz as categorias com o caminho do pai para quem tem permissão numa pessoa física',
    { tags: ['@KAN-27-CA4'] },
    async () => {
      const owner = await newSession(app);
      const person = await newEntity(owner, 'individual');
      const company = await newEntity(owner, 'company');
      const prefix = uniquePrefix();
      const parent = await newCategory(owner, { name: `${prefix} Moradia`, nature: 'expense' });
      const child = await newCategory(owner, { name: `${prefix} Energia`, parentId: parent.id });

      const { token: viewer } = await newSessionByRoute(app, owner, {
        permissions: [{ entityId: person.id, level: 'view' }],
      });
      const found = (await authed(viewer, 'get', '/v1/search').query({ term: prefix }).expect(200)).body as {
        categories: unknown[];
      };
      expect(found.categories).toEqual([
        { id: child.id, name: child.name, nature: 'expense', parentName: parent.name, active: true },
        { id: parent.id, name: parent.name, nature: 'expense', parentName: null, active: true },
      ]);

      const { token: companyOnly } = await newSessionByRoute(app, owner, {
        permissions: [{ entityId: company.id, level: 'operate' }],
      });
      const none = (await authed(companyOnly, 'get', '/v1/search').query({ term: prefix }).expect(200)).body as {
        categories: unknown[];
      };
      expect(none.categories).toEqual([]);
      const refused = await list(companyOnly, { nature: 'expense' }).expect(403);
      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
    },
  );

  // Sem critério de aceite: com o filtro de estado, a categoria de primeiro nível que não passa por ele só
  // aparece como o caminho da subcategoria que passa, e não como achada.
  it('com o filtro de estado, o pai que não passa aparece só como caminho', async () => {
    const token = await newOperator();
    const prefix = uniquePrefix();
    const parent = await newCategory(token, { name: `${prefix} Casa`, nature: 'expense' });
    const child = await newCategory(token, { name: `${prefix} Luz`, parentId: parent.id });
    const deactivated = (await setActive(token, child, false).expect(200)).body as Category;

    const inactive = await treeOf(token, { nature: 'expense', q: prefix, active: 'false' });

    expect(inactive.items).toEqual([
      {
        ...parent,
        matched: false,
        monthTotal: '0.00',
        children: [{ ...deactivated, matched: true, monthTotal: '0.00' }],
      },
    ]);
  });
});
