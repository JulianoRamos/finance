import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  authedRequest,
  buildTestApp,
  newSession,
  newSessionByRoute,
  TestClock,
  uniqueName,
  uniquePrefix,
  type User,
} from './support/app.js';
import { uniqueCnpj } from './support/tax-ids.js';

/** Uma entidade, como o contrato a descreve. */
interface Entity {
  readonly id: string;
  readonly name: string;
  readonly taxId: string | null;
  readonly active: boolean;
  readonly operations: string[];
  readonly version: number;
}

/** Uma página, como o contrato a descreve. */
interface Page<T> {
  readonly items: T[];
  readonly total: number;
}

describe('Permissões por entidade', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão. */
  function authed(token: string, method: 'get' | 'post' | 'put' | 'delete', url: string) {
    return authedRequest(app, token, method, url);
  }

  /** Cadastra a entidade com o token e a devolve. */
  async function newEntity(token: string, body: Record<string, unknown>): Promise<Entity> {
    return (await authed(token, 'post', '/v1/entities').send(body).expect(201)).body as Entity;
  }

  /** O pedido de ler a entidade. */
  function getEntity(token: string, id: string) {
    return authed(token, 'get', `/v1/entities/${id}`);
  }

  /** O pedido de gravar os acessos do usuário. */
  function setAccess(token: string, user: User, permissions: { entityId: string; level: string }[], version: number) {
    return authed(token, 'put', `/v1/users/${user.id}/access`).send({
      version,
      managesAccess: user.managesAccess,
      permissions,
    });
  }

  it(
    'define ver ou operar por entidade, e a entidade sem permissão é recusada',
    { tags: ['@KAN-13-CA3'] },
    async () => {
      const manager = await newSession(app);
      const prefix = uniquePrefix();
      const first = await newEntity(manager, { type: 'individual', name: uniqueName(`${prefix} A`) });
      const second = await newEntity(manager, { type: 'individual', name: uniqueName(`${prefix} B`) });
      const { user, token } = await newSessionByRoute(app, manager, {
        permissions: [{ entityId: first.id, level: 'view' }],
      });

      await getEntity(token, first.id).expect(200);
      const refused = await getEntity(token, second.id).expect(403);
      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
      const listed = await authed(token, 'get', '/v1/entities').query({ q: prefix }).expect(200);
      expect((listed.body as Page<Entity>).items.map((entity) => entity.id)).toEqual([first.id]);
      expect((listed.body as Page<Entity>).total).toBe(1);

      const permissions = await authed(manager, 'get', `/v1/users/${user.id}/permissions`)
        .query({ q: prefix })
        .expect(200);
      expect(permissions.body).toMatchObject({
        total: 2,
        items: [
          { entityId: first.id, level: 'view' },
          { entityId: second.id, level: 'none' },
        ],
      });

      // A senha definida pelo link subiu a versão do cadastro.
      const read = (await authed(manager, 'get', `/v1/users/${user.id}`).expect(200)).body as User;
      const saved = await setAccess(
        manager,
        user,
        [
          { entityId: second.id, level: 'operate' },
          { entityId: first.id, level: 'none' },
        ],
        read.version,
      ).expect(200);
      expect(saved.body).toMatchObject({ id: user.id, version: read.version + 1 });
      await getEntity(token, second.id).expect(200);
      const nowRefused = await getEntity(token, first.id).expect(403);
      expect(nowRefused.body).toMatchObject({ code: 'FORBIDDEN' });

      const own = await newEntity(manager, { type: 'individual', name: uniqueName(prefix) });
      await getEntity(manager, own.id).expect(200);
      // O nível é operate, e não só view: quem cadastra também a altera.
      await authed(manager, 'put', `/v1/entities/${own.id}`)
        .send({ version: own.version, type: 'individual', name: own.name })
        .expect(200);
      const ownList = await authed(manager, 'get', '/v1/entities').query({ q: own.name }).expect(200);
      expect((ownList.body as Page<Entity>).items.map((entity) => entity.id)).toEqual([own.id]);
    },
  );

  it('quem só vê tem a escrita na entidade recusada', { tags: ['@KAN-13-CA4'] }, async () => {
    const manager = await newSession(app);
    const company = await newEntity(manager, { type: 'company', name: uniqueName('Clínica'), taxId: uniqueCnpj() });
    const { user, token } = await newSessionByRoute(app, manager, {
      permissions: [{ entityId: company.id, level: 'view' }],
    });

    const refused = [
      await authed(token, 'put', `/v1/entities/${company.id}`)
        .send({ version: company.version, type: 'company', name: uniqueName('Outro nome') })
        .expect(403),
      await authed(token, 'put', `/v1/entities/${company.id}/active`)
        .send({ active: false, version: company.version })
        .expect(403),
      await authed(token, 'put', `/v1/entities/${company.id}/operations/clinic`).expect(403),
      await authed(token, 'delete', `/v1/entities/${company.id}/operations/clinic`).expect(403),
    ];

    for (const response of refused) expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    const unchanged = (await getEntity(token, company.id).expect(200)).body as Entity;
    expect(unchanged).toEqual(company);

    const read = (await authed(manager, 'get', `/v1/users/${user.id}`).expect(200)).body as User;
    await setAccess(manager, user, [{ entityId: company.id, level: 'operate' }], read.version).expect(200);
    const name = uniqueName('Nome novo');
    const edited = await authed(token, 'put', `/v1/entities/${company.id}`)
      .send({ version: company.version, type: 'company', name, taxId: company.taxId })
      .expect(200);
    expect(edited.body).toMatchObject({ id: company.id, name, version: company.version + 1 });
  });
});
