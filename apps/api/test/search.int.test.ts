import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  authedRequest,
  buildTestApp,
  newSession,
  newSessionByRoute,
  newUserByRoute,
  TestClock,
  uniquePrefix,
} from './support/app.js';

/** Uma entidade, como a rota de cadastro a devolve. */
interface Entity {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
}

describe('Pesquisa', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Cadastra a entidade com o token e a devolve. */
  async function newEntity(token: string, type: 'individual' | 'company', name: string): Promise<Entity> {
    return (await authedRequest(app, token, 'post', '/v1/entities').send({ type, name }).expect(201)).body as Entity;
  }

  /** Cria o grupo com os membros e devolve o id. */
  async function newGroup(token: string, name: string, memberIds: string[]): Promise<string> {
    const response = await authedRequest(app, token, 'post', '/v1/financial-groups')
      .send({ name, memberIds })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  /** O pedido da pesquisa com o termo dado, ou sem ele. */
  function search(token: string, term?: string) {
    const query = term === undefined ? '' : `?term=${encodeURIComponent(term)}`;
    return authedRequest(app, token, 'get', `/v1/search${query}`);
  }

  it('acha pelo nome sem acento nem maiúsculas, até 5 por tipo', { tags: ['@KAN-18-CA1'] }, async () => {
    const manager = await newSession(app);
    const marker = uniquePrefix().toUpperCase();
    const entities: Entity[] = [];
    // As três primeiras são pessoas físicas, e as outras, empresas.
    for (const n of [1, 2, 3, 4, 5, 6]) {
      entities.push(await newEntity(manager, n <= 3 ? 'individual' : 'company', `Ávila ${marker} ${String(n)}`));
    }
    const [first, , , fourth, , sixth] = entities as [Entity, Entity, Entity, Entity, Entity, Entity];
    const groupId = await newGroup(manager, `Grupo Ávila ${marker}`, [first.id, fourth.id]);
    const { user } = await newUserByRoute(app, manager, { name: `Bruno Ávila ${marker}` });

    const found = await search(manager, `avila ${marker.toLowerCase()}`).expect(200);

    expect(found.body).toEqual({
      entities: entities.slice(0, 5).map(({ id, type, name }) => ({ id, type, name, active: true })),
      financialGroups: [
        { id: groupId, name: `Grupo Ávila ${marker}`, isFamilyView: false, individuals: 1, companies: 1 },
      ],
      users: [{ id: user.id, name: user.name, email: user.email, active: true }],
    });

    await authedRequest(app, manager, 'put', `/v1/entities/${sixth.id}/active`)
      .send({ active: false, version: sixth.version })
      .expect(200);
    const inactive = await search(manager, `avila ${marker.toLowerCase()} 6`).expect(200);

    expect(inactive.body).toEqual({
      entities: [{ id: sixth.id, type: 'company', name: sixth.name, active: false }],
      financialGroups: [],
      users: [],
    });
  });

  it(
    'devolve só o que o usuário pode ver, e os usuários só a quem gere acessos',
    { tags: ['@KAN-18-CA2'] },
    async () => {
      const manager = await newSession(app);
      const marker = uniquePrefix();
      const viewer = await newSessionByRoute(app, manager);
      const a = await newEntity(viewer.token, 'individual', `${marker} Entidade A`);
      const b = await newEntity(manager, 'individual', `${marker} Entidade B`);
      const onlyA = await newGroup(manager, `${marker} Grupo A`, [a.id]);
      await newGroup(manager, `${marker} Grupo AB`, [a.id, b.id]);
      const empty = await newGroup(manager, `${marker} Grupo Vazio`, []);
      const { user } = await newUserByRoute(app, manager, { name: `${marker} Usuário` });
      const accessManager = await newSessionByRoute(app, manager, {
        managesAccess: true,
        permissions: [{ entityId: a.id, level: 'view' }],
      });

      const seenByViewer = await search(viewer.token, marker).expect(200);
      const seenByAccessManager = await search(accessManager.token, marker).expect(200);

      const visible = {
        entities: [{ id: a.id, type: 'individual', name: a.name, active: true }],
        financialGroups: [
          { id: onlyA, name: `${marker} Grupo A`, isFamilyView: false, individuals: 1, companies: 0 },
          { id: empty, name: `${marker} Grupo Vazio`, isFamilyView: false, individuals: 0, companies: 0 },
        ],
      };
      expect(seenByViewer.body).toEqual({ ...visible, users: [] });
      expect(seenByAccessManager.body).toEqual({
        ...visible,
        users: [{ id: user.id, name: user.name, email: user.email, active: true }],
      });
    },
  );

  it('recusa o termo com menos de 2 caracteres', { tags: ['@KAN-18-CA3'] }, async () => {
    const token = await newSession(app);

    for (const term of ['a', ' a ', undefined, 'a'.repeat(121)]) {
      const refused = await search(token, term).expect(400);

      expect(refused.body).toMatchObject({ code: 'INVALID_INPUT' });
      expect(Object.keys((refused.body as { fields: Record<string, string> }).fields)).toEqual(['term']);
    }
  });
});
