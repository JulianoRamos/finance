import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  getCurrentSession,
  loginAs,
  newSession,
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

/** Um login do teste: o token e o id da sessão que ele abriu. */
interface Login {
  readonly token: string;
  readonly id: string;
}

/** A página das sessões, como o contrato a descreve. */
interface SessionPage {
  readonly items: SessionSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
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

  /** O pedido da lista das sessões ativas, com o token e a query dada. */
  function listSessions(token: string, query: Record<string, string> = {}) {
    return request(app.getHttpServer()).get('/v1/sessions').query(query).auth(token, { type: 'bearer' });
  }

  /** A página das sessões ativas vista com o token, que responde 200. */
  async function pageOf(token: string, query: Record<string, string> = {}): Promise<SessionPage> {
    return (await listSessions(token, query).expect(200)).body as SessionPage;
  }

  /** As sessões ativas da primeira página vista com o token. */
  async function sessionsOf(token: string): Promise<SessionSummary[]> {
    return (await pageOf(token)).items;
  }

  /** O id da sessão do token, como a lista vista com ele a marca. */
  async function currentIdOf(token: string): Promise<string> {
    const current = (await sessionsOf(token)).find((session) => session.current);
    if (!current) throw new Error('A lista não trouxe a sessão corrente.');
    return current.id;
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
    const idB = await currentIdOf(tokenB);
    expect((await sessionsOf(tokenA)).map((session) => session.id)).toContain(idB);

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

  it('pagina as sessões ativas do usuário, a corrente primeiro', { tags: ['@KAN-20-CA1'] }, async () => {
    const email = uniqueEmail();
    // O uso do link na preparação abre a sessão que vai vencer por inatividade.
    await newUserWithPassword(app, email, TEST_PASSWORD);
    clock.advance({ days: 8 });
    // Aberta depois do avanço, a sessão do outro usuário vale: só o filtro pelo usuário a tira da lista.
    await newSession(app);
    const logins: Login[] = [];
    for (let login = 0; login < 5; login += 1) {
      if (login > 0) clock.advance({ minutes: 1 });
      const token = await loginAs(app, email, TEST_PASSWORD);
      // Lida no mesmo instante do login, a lista não muda o último uso da sessão.
      logins.push({ token, id: await currentIdOf(token) });
    }
    const [first, second, third, fourth, fifth] = logins as [Login, Login, Login, Login, Login];
    await logout(second.token).expect(204);

    const [firstPage, secondPage, whole] = await Promise.all([
      pageOf(third.token, { page: '1', pageSize: '2' }),
      pageOf(third.token, { page: '2', pageSize: '2' }),
      pageOf(third.token),
    ]);

    expect(firstPage).toMatchObject({ total: 4, page: 1, pageSize: 2 });
    expect(firstPage.items.map(({ id, current }) => ({ id, current }))).toEqual([
      { id: third.id, current: true },
      { id: fifth.id, current: false },
    ]);
    expect(secondPage).toMatchObject({ total: 4, page: 2, pageSize: 2 });
    expect(secondPage.items.map(({ id, current }) => ({ id, current }))).toEqual([
      { id: fourth.id, current: false },
      { id: first.id, current: false },
    ]);
    expect(whole).toMatchObject({ total: 4, page: 1, pageSize: 10 });
    expect(whole.items.map((session) => session.id)).toEqual([third.id, fifth.id, fourth.id, first.id]);
    expect(whole.items.map((session) => session.id)).not.toContain(second.id);
  });

  it('recusa a página e o tamanho das sessões fora dos limites', { tags: ['@KAN-20-CA2'] }, async () => {
    const token = await newSession(app);

    const [pageZero, tooLarge] = await Promise.all([
      listSessions(token, { page: '0' }).expect(400),
      listSessions(token, { pageSize: '101' }).expect(400),
    ]);

    expect(pageZero.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (pageZero.body as { fields?: { page?: unknown } }).fields?.page).toBe('string');
    expect(tooLarge.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (tooLarge.body as { fields?: { pageSize?: unknown } }).fields?.pageSize).toBe('string');
  });
});
