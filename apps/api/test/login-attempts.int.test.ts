import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  newUserWithPassword,
  postLogin,
  TEST_PASSWORD,
  TestClock,
  uniqueEmail,
  uniqueOrigin,
} from './support/app.js';

const WRONG_PASSWORD = 'senha-errada-123';

describe('Limite de tentativas de login', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia o e-mail depois de cinco falhas em 15 minutos', { tags: ['@KAN-9-CA5'] }, async () => {
    const email = uniqueEmail();
    const missing = uniqueEmail();
    const origin = uniqueOrigin();
    await newUserWithPassword(app, email, TEST_PASSWORD);

    for (let attempt = 1; attempt <= 5; attempt++) {
      clock.advance({ minutes: 2 });
      await postLogin(app, email, WRONG_PASSWORD, origin).expect(401);
      await postLogin(app, missing, WRONG_PASSWORD, origin).expect(401);
    }
    const fifthFailure = clock.now();

    const blocked = await postLogin(app, email, TEST_PASSWORD, origin).expect(429);
    const blockedMissing = await postLogin(app, missing, TEST_PASSWORD, origin).expect(429);
    expect(blocked.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    expect(blockedMissing.body).toEqual(blocked.body);

    clock.set(new Date(fifthFailure.getTime() + 15 * 60 * 1000));
    await postLogin(app, email, TEST_PASSWORD, origin).expect(201);
  });

  it('bloqueia a origem depois de vinte falhas', { tags: ['@KAN-9-CA5'] }, async () => {
    const email = uniqueEmail();
    const origin = uniqueOrigin();
    await newUserWithPassword(app, email, TEST_PASSWORD);

    for (let attempt = 1; attempt <= 20; attempt++) {
      await postLogin(app, uniqueEmail(), WRONG_PASSWORD, origin).expect(401);
    }

    const blocked = await postLogin(app, email, TEST_PASSWORD, origin).expect(429);
    expect(blocked.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    await postLogin(app, email, TEST_PASSWORD, uniqueOrigin()).expect(201);
  });

  it('tentativas simultâneas não passam juntas do limite do e-mail', async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => postLogin(app, email, WRONG_PASSWORD, uniqueOrigin())),
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
  });
});
