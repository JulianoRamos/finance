import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  authedRequest,
  buildTestApp,
  getCurrentSession,
  newSession,
  newSessionByRoute,
  TestClock,
  uniqueName,
  type User,
} from './support/app.js';

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

/** Uma entidade, só com o que os testes do histórico usam. */
interface Entity {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

describe('Histórico de alterações da entidade', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão. */
  function authed(token: string, method: 'get' | 'post' | 'put', url: string) {
    return authedRequest(app, token, method, url);
  }

  /** Cadastra uma entidade e a devolve. */
  async function newEntity(token: string, type: 'individual' | 'company', name = uniqueName('Histórico')) {
    return (await authed(token, 'post', '/v1/entities').send({ type, name }).expect(201)).body as Entity;
  }

  /** O usuário da sessão. */
  async function userOf(token: string): Promise<{ id: string; name: string }> {
    const session = (await getCurrentSession(app, token).expect(200)).body as { user: { id: string; name: string } };
    return { id: session.user.id, name: session.user.name };
  }

  /** O pedido do histórico da entidade. */
  function getHistory(token: string, id: string, query: Record<string, string> = {}) {
    return authed(token, 'get', `/v1/entities/${id}/history`).query(query);
  }

  it(
    'o histórico da entidade traz as alterações dela, da mais recente para a mais antiga, campo a campo',
    { tags: ['@KAN-16-CA1'] },
    async () => {
      const token = await newSession(app);
      const user = await userOf(token);
      const oldName = uniqueName('Clínica antiga');
      const newName = uniqueName('Clínica nova');
      const company = await newEntity(token, 'company', oldName);
      await authed(token, 'put', `/v1/entities/${company.id}`)
        .send({ version: 1, type: 'company', name: newName, taxId: null })
        .expect(200);
      await authed(token, 'put', `/v1/entities/${company.id}/active`).send({ active: false, version: 2 }).expect(200);
      await authed(token, 'put', `/v1/entities/${company.id}/active`).send({ active: true, version: 3 }).expect(200);
      await authed(token, 'put', `/v1/entities/${company.id}/operations/clinic`).expect(200);
      const person = await newEntity(token, 'individual');
      const stake = (
        await authed(token, 'post', `/v1/entities/${company.id}/equity-stakes`)
          .send({ holderId: person.id, fraction: '0.25', startDate: '2026-11-01', endDate: '2026-12-31' })
          .expect(201)
      ).body as { id: string };
      await authed(token, 'post', '/v1/financial-groups')
        .send({ name: uniqueName('Grupo do histórico'), memberIds: [company.id] })
        .expect(201);

      const first = (await getHistory(token, company.id, { pageSize: '3' }).expect(200)).body as AuditHistoryPage;
      const second = (await getHistory(token, company.id, { pageSize: '3', page: '2' }).expect(200))
        .body as AuditHistoryPage;

      expect(first).toMatchObject({ total: 6, page: 1, pageSize: 3 });
      expect(second).toMatchObject({ total: 6, page: 2, pageSize: 3 });
      const entry = (
        action: AuditHistoryEntry['action'],
        tableName: string,
        recordId: string,
        changes: AuditChange[],
        subject: string | null = null,
      ) => ({
        id: expect.any(String) as string,
        occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
        user,
        action,
        tableName,
        recordId,
        subject,
        changes,
      });
      expect(first.items).toEqual([
        entry(
          'create',
          'equity_stake',
          stake.id,
          [
            { field: 'fraction', before: null, after: '0.25' },
            { field: 'startDate', before: null, after: '2026-11-01' },
            { field: 'endDate', before: null, after: '2026-12-31' },
          ],
          person.name,
        ),
        entry('create', 'entity_operation', expect.any(String) as string, [
          { field: 'operation', before: null, after: 'clinic' },
        ]),
        entry('update', 'entity', company.id, [{ field: 'active', before: false, after: true }]),
      ]);
      expect(second.items).toEqual([
        entry('update', 'entity', company.id, [{ field: 'active', before: true, after: false }]),
        entry('update', 'entity', company.id, [{ field: 'name', before: oldName, after: newName }]),
        entry('create', 'entity', company.id, [
          { field: 'type', before: null, after: 'company' },
          { field: 'name', before: null, after: oldName },
          { field: 'active', before: null, after: true },
        ]),
      ]);

      const past = (await getHistory(token, company.id, { pageSize: '3', page: '3' }).expect(200))
        .body as AuditHistoryPage;
      expect(past).toMatchObject({ total: 6, items: [] });
      const invalid = await getHistory(token, company.id, { pageSize: '0' }).expect(400);
      expect(invalid.body).toMatchObject({ code: 'INVALID_INPUT' });
    },
  );

  it('o histórico respeita a permissão na entidade', { tags: ['@KAN-16-CA2'] }, async () => {
    const owner = await newSession(app);
    const ownerUser = await userOf(owner);
    const company = await newEntity(owner, 'company');
    const { user: reader, token } = await newSessionByRoute(app, owner);

    for (const id of [company.id, randomUUID()]) {
      const refused = await getHistory(token, id).expect(403);
      expect(refused.body).toMatchObject({ code: 'FORBIDDEN' });
    }

    const read = (await authed(owner, 'get', `/v1/users/${reader.id}`).expect(200)).body as User;
    await authed(owner, 'put', `/v1/users/${reader.id}/access`)
      .send({ version: read.version, managesAccess: false, permissions: [{ entityId: company.id, level: 'view' }] })
      .expect(200);
    const history = (await getHistory(token, company.id).expect(200)).body as AuditHistoryPage;
    expect(history.total).toBe(1);
    expect(history.items).toEqual([
      expect.objectContaining({ action: 'create', tableName: 'entity', recordId: company.id, user: ownerUser }),
    ]);

    const anonymous = await request(app.getHttpServer()).get(`/v1/entities/${company.id}/history`).expect(401);
    expect(anonymous.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
