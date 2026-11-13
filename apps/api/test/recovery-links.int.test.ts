import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  newUserLink,
  postLogin,
  redeemLink,
  TestClock,
  uniqueEmail,
  uniqueOrigin,
} from './support/app.js';

/** Uma senha de exatamente 12 caracteres, o mínimo da regra 6.1. */
const PASSWORD = 'doze-letras!';

describe('Links de recuperação', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  it('define a senha pelo link', { tags: ['@KAN-9-CA2'] }, async () => {
    const email = uniqueEmail();
    const origin = uniqueOrigin();
    const token = await newUserLink(app, email);

    const used = await redeemLink(app, token, PASSWORD, { origin }).expect(201);
    const session = used.body as { token: unknown; expiresAt: unknown };
    expect(typeof session.token).toBe('string');
    expect(Number.isNaN(Date.parse(String(session.expiresAt)))).toBe(false);

    await postLogin(app, email, PASSWORD, origin).expect(201);
  });

  it('o link não vale uma segunda vez', { tags: ['@KAN-9-CA2'] }, async () => {
    const email = uniqueEmail();
    const origin = uniqueOrigin();
    const token = await newUserLink(app, email);
    const server = request(app.getHttpServer());
    const other = 'outra-senha-longa';
    await redeemLink(app, token, PASSWORD, { origin }).expect(201);

    const found = await server.get(`/v1/recovery-links/${token}`).set('X-Forwarded-For', origin).expect(404);
    const usedAgain = await redeemLink(app, token, other, { origin }).expect(404);

    expect(found.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(usedAgain.body).toMatchObject({ code: 'NOT_FOUND' });
    await postLogin(app, email, other, origin).expect(401);
    await postLogin(app, email, PASSWORD, origin).expect(201);
  });

  it('o link não vale depois de vencido', { tags: ['@KAN-9-CA2'] }, async () => {
    const email = uniqueEmail();
    const origin = uniqueOrigin();
    const token = await newUserLink(app, email);
    const server = request(app.getHttpServer());

    clock.advance({ minutes: 60, seconds: 1 });
    const found = await server.get(`/v1/recovery-links/${token}`).set('X-Forwarded-For', origin).expect(404);
    const used = await redeemLink(app, token, PASSWORD, { origin }).expect(404);

    expect(found.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(used.body).toMatchObject({ code: 'NOT_FOUND' });
    // O usuário continua sem senha: nenhuma senha entra.
    await postLogin(app, email, PASSWORD, origin).expect(401);
  });
});
