import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FINANCIAL_CONTEXT_HEADER } from '../src/common/index.js';
import {
  authedRequest,
  buildTestApp,
  newSession,
  newSessionByRoute,
  TestClock,
  uniqueName,
  uniquePrefix,
} from './support/app.js';
import { uniqueCnpj } from './support/tax-ids.js';

/** Uma entidade, como o contrato a descreve. */
interface Entity {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly active: boolean;
}

describe('Contexto financeiro', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Cadastra a entidade com o token e a devolve. */
  async function newEntity(token: string, body: Record<string, unknown>): Promise<Entity> {
    return (await authedRequest(app, token, 'post', '/v1/entities').send(body).expect(201)).body as Entity;
  }

  /** Uma empresa nova, com o nome do prefixo. */
  function newCompany(token: string, prefix: string): Promise<Entity> {
    return newEntity(token, { type: 'company', name: uniqueName(`${prefix} Empresa`), taxId: uniqueCnpj() });
  }

  /** Cria o grupo com os membros e o devolve. */
  async function newGroup(token: string, name: string, memberIds: string[]): Promise<{ id: string; name: string }> {
    return (await authedRequest(app, token, 'post', '/v1/financial-groups').send({ name, memberIds }).expect(201))
      .body as { id: string; name: string };
  }

  /** O pedido de ler o contexto financeiro, com o cabeçalho dado, ou sem ele. */
  function getContext(token: string, context?: string) {
    const pending = authedRequest(app, token, 'get', '/v1/financial-context');
    return context === undefined ? pending : pending.set(FINANCIAL_CONTEXT_HEADER, context);
  }

  it(
    'o contexto sem o cabeçalho, ou com uma entidade sem permissão, é recusado',
    { tags: ['@KAN-14-CA3'] },
    async () => {
      const manager = await newSession(app);
      const prefix = uniquePrefix();
      const allowed = await newCompany(manager, prefix);
      const other = await newCompany(manager, prefix);
      const { token } = await newSessionByRoute(app, manager, {
        permissions: [{ entityId: allowed.id, level: 'view' }],
      });

      const missing = await getContext(token).expect(400);
      const notUuid = await getContext(token, 'entity:abc').expect(400);
      const unknownKind = await getContext(token, `account:${allowed.id}`).expect(400);
      const read = await getContext(token, `entity:${allowed.id}`).expect(200);
      const forbidden = await getContext(token, `entity:${other.id}`).expect(403);
      const nonexistent = await getContext(token, 'entity:0190d3f2-6c1e-7a4b-9f00-1a2b3c4d5e6f').expect(403);
      const noGroup = await getContext(token, 'group:0190d3f2-6c1e-7a4b-9f00-1a2b3c4d5e6f').expect(403);

      for (const invalid of [missing, notUuid]) {
        expect(invalid.body).toMatchObject({ code: 'INVALID_INPUT' });
        expect(Object.keys((invalid.body as { fields: Record<string, string> }).fields)).toEqual([
          FINANCIAL_CONTEXT_HEADER,
        ]);
      }
      expect(unknownKind.body).toMatchObject({ code: 'INVALID_INPUT' });
      expect(read.body).toEqual({
        kind: 'entity',
        id: allowed.id,
        name: allowed.name,
        isFamilyView: false,
        entities: [{ id: allowed.id, type: 'company', name: allowed.name, active: true }],
      });
      for (const refused of [forbidden, nonexistent, noGroup])
        expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
    },
  );

  it(
    'um grupo resolve nas entidades membros e é recusado sem a permissão em todas',
    { tags: ['@KAN-14-CA4'] },
    async () => {
      const manager = await newSession(app);
      const prefix = uniquePrefix();
      const person = await newEntity(manager, { type: 'individual', name: uniqueName(`${prefix} Pessoa`) });
      const company = await newCompany(manager, prefix);
      const group = await newGroup(manager, uniqueName(`${prefix} Grupo`), [company.id, person.id]);
      const empty = await newGroup(manager, uniqueName(`${prefix} Vazio`), []);
      const { user, token } = await newSessionByRoute(app, manager, {
        permissions: [
          { entityId: person.id, level: 'view' },
          { entityId: company.id, level: 'view' },
        ],
      });
      const listGroups = () =>
        authedRequest(app, token, 'get', `/v1/financial-groups?q=${encodeURIComponent(`${prefix} Grupo`)}`).expect(200);

      const read = await getContext(token, `group:${group.id}`).expect(200);
      const listed = await listGroups();
      await authedRequest(app, token, 'get', `/v1/financial-groups/${group.id}`).expect(200);
      const emptyRead = await getContext(token, `group:${empty.id}`).expect(200);

      // Os nomes têm o mesmo prefixo, e "Empresa" vem antes de "Pessoa".
      expect(read.body).toEqual({
        kind: 'group',
        id: group.id,
        name: group.name,
        isFamilyView: false,
        entities: [company, person].map(({ id, type, name }) => ({ id, type, name, active: true })),
      });
      expect(listed.body).toMatchObject({ total: 1, items: [{ id: group.id }] });
      expect(emptyRead.body).toMatchObject({ kind: 'group', id: empty.id, entities: [] });

      const current = (await authedRequest(app, manager, 'get', `/v1/users/${user.id}`).expect(200)).body as {
        version: number;
      };
      await authedRequest(app, manager, 'put', `/v1/users/${user.id}/access`)
        .send({
          version: current.version,
          managesAccess: false,
          permissions: [{ entityId: company.id, level: 'none' }],
        })
        .expect(200);

      const refused = await getContext(token, `group:${group.id}`).expect(403);
      const hidden = await listGroups();
      const refusedRead = await authedRequest(app, token, 'get', `/v1/financial-groups/${group.id}`).expect(403);

      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
      expect(hidden.body).toMatchObject({ total: 0, items: [] });
      expect(refusedRead.body).toMatchObject({ code: 'FORBIDDEN' });
    },
  );
});
