import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, loginAs, newUserWithPassword, TEST_PASSWORD, TestClock, uniqueEmail } from './support/app.js';

describe('Sessões', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** A resposta da sessão corrente com o token. */
  function current(token: string) {
    return request(app.getHttpServer()).get('/v1/sessions/current').auth(token, { type: 'bearer' });
  }

  it('recusa a sessão depois de 7 dias sem uso', { tags: ['@KAN-9-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    clock.advance({ days: 6 });
    await current(token).expect(200);
    clock.advance({ days: 6 });
    await current(token).expect(200);
    clock.advance({ days: 7, seconds: 1 });
    const refused = await current(token).expect(401);

    expect(refused.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('recusa a sessão 30 dias depois do login, mesmo em uso', { tags: ['@KAN-9-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    for (let day = 6; day <= 30; day += 6) {
      clock.advance({ days: 6 });
      await current(token).expect(200);
    }
    clock.advance({ seconds: 1 });
    const refused = await current(token).expect(401);

    expect(refused.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
