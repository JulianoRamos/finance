import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  getCurrentSession,
  loginAs,
  newUserWithPassword,
  TEST_PASSWORD,
  TestClock,
  uniqueEmail,
} from './support/app.js';

/** Uma sessão da lista, como o contrato a descreve. */
interface SessionSummary {
  readonly id: string;
  readonly current: boolean;
}

describe('Sessões', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** A lista das sessões ativas vista com o token, que responde 200. */
  async function sessionsOf(token: string): Promise<SessionSummary[]> {
    const response = await request(app.getHttpServer()).get('/v1/sessions').auth(token, { type: 'bearer' }).expect(200);
    return response.body as SessionSummary[];
  }

  /** O pedido de sair, com o token. */
  function logout(token: string) {
    return request(app.getHttpServer()).delete('/v1/sessions/current').auth(token, { type: 'bearer' });
  }

  /** O pedido de encerrar a sessão do id, com o token. */
  function end(token: string, id: string) {
    return request(app.getHttpServer()).delete(`/v1/sessions/${id}`).auth(token, { type: 'bearer' });
  }

  it('recusa a sessão depois de 7 dias sem uso', { tags: ['@KAN-9-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    clock.advance({ days: 6 });
    await getCurrentSession(app, token).expect(200);
    clock.advance({ days: 6 });
    await getCurrentSession(app, token).expect(200);
    clock.advance({ days: 7, seconds: 1 });
    const refused = await getCurrentSession(app, token).expect(401);

    expect(refused.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('recusa a sessão 30 dias depois do login, mesmo em uso', { tags: ['@KAN-9-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    for (let day = 6; day <= 30; day += 6) {
      clock.advance({ days: 6 });
      await getCurrentSession(app, token).expect(200);
    }
    clock.advance({ seconds: 1 });
    const refused = await getCurrentSession(app, token).expect(401);

    expect(refused.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('encerrar uma sessão a invalida na hora', { tags: ['@KAN-10-CA2'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const tokenA = await loginAs(app, email, TEST_PASSWORD);
    const tokenB = await loginAs(app, email, TEST_PASSWORD);
    const idB = (await sessionsOf(tokenA)).find((session) => !session.current)?.id;
    if (!idB) throw new Error('A lista vista por A não trouxe a sessão B.');

    await end(tokenA, idB).expect(204);

    expect((await getCurrentSession(app, tokenB).expect(401)).body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((await sessionsOf(tokenA)).map((session) => session.id)).not.toContain(idB);
    expect((await end(tokenA, idB).expect(404)).body).toMatchObject({ code: 'NOT_FOUND' });
    await getCurrentSession(app, tokenA).expect(200);
  });

  it('sair encerra a sessão corrente, mesmo que ela já tenha sido encerrada por outra', async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const tokenA = await loginAs(app, email, TEST_PASSWORD);
    const tokenB = await loginAs(app, email, TEST_PASSWORD);
    const idB = (await sessionsOf(tokenA)).find((session) => !session.current)?.id;
    if (!idB) throw new Error('A lista vista por A não trouxe a sessão B.');

    // Dois "Sair" ao mesmo tempo em B: o segundo chega depois de o guard aceitar o token.
    const [first, second] = await Promise.all([logout(tokenB), logout(tokenB)]);

    expect([first.status, second.status].sort()).toContain(204);
    expect([first.status, second.status].every((status) => status === 204 || status === 401)).toBe(true);
    await getCurrentSession(app, tokenB).expect(401);
    await getCurrentSession(app, tokenA).expect(200);
  });

  it('um usuário não vê nem encerra as sessões de outro', { tags: ['@KAN-10-CA3'] }, async () => {
    const [first, second] = [uniqueEmail(), uniqueEmail()];
    await newUserWithPassword(app, first, TEST_PASSWORD);
    await newUserWithPassword(app, second, TEST_PASSWORD);
    const firstToken = await loginAs(app, first, TEST_PASSWORD);
    const secondToken = await loginAs(app, second, TEST_PASSWORD);
    // O uso do link na preparação também abriu uma sessão de cada um.
    const secondSessions = await sessionsOf(secondToken);
    const secondIds = secondSessions.map((session) => session.id);
    const secondSession = secondSessions.find((session) => session.current);
    if (!secondSession) throw new Error('A lista do segundo não trouxe a sessão corrente.');

    const firstIds = (await sessionsOf(firstToken)).map((session) => session.id);
    expect(firstIds).toHaveLength(2);
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
    const refused = await end(firstToken, secondSession.id).expect(404);
    const missing = await end(firstToken, randomUUID()).expect(404);

    expect(refused.body).toEqual(missing.body);
    expect(refused.body).toMatchObject({ code: 'NOT_FOUND' });
    await getCurrentSession(app, secondToken).expect(200);
    expect((await sessionsOf(secondToken)).map((session) => session.id)).toContain(secondSession.id);
  });
});
