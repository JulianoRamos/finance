import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  getCurrentSession,
  loginAs,
  newUserWithPassword,
  postLogin,
  TEST_PASSWORD,
  TestClock,
  uniqueEmail,
  uniqueOrigin,
} from './support/app.js';

const NEW_PASSWORD = 'outra-senha-de-teste';

describe('Troca de senha', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** O pedido de troca de senha com o token, de uma origem própria salvo outra dada. */
  function changePassword(
    token: string,
    body: { currentPassword: string; password: string; passwordConfirmation?: string },
    origin = uniqueOrigin(),
  ) {
    return request(app.getHttpServer())
      .put('/v1/users/me/password')
      .auth(token, { type: 'bearer' })
      .set('X-Forwarded-For', origin)
      .send({ passwordConfirmation: body.password, ...body });
  }

  it('a troca de senha recusa a senha atual errada', { tags: ['@KAN-10-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const tokenA = await loginAs(app, email, TEST_PASSWORD);
    const tokenB = await loginAs(app, email, TEST_PASSWORD);

    const refused = await changePassword(tokenA, {
      currentPassword: 'senha-errada-000',
      password: NEW_PASSWORD,
    }).expect(422);

    expect(refused.body).toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    await getCurrentSession(app, tokenB).expect(200);
    await postLogin(app, email, TEST_PASSWORD).expect(201);
  });

  it('a troca de senha encerra as outras sessões e mantém a atual', { tags: ['@KAN-10-CA4'] }, async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const tokenA = await loginAs(app, email, TEST_PASSWORD);
    const tokenB = await loginAs(app, email, TEST_PASSWORD);

    await changePassword(tokenA, { currentPassword: TEST_PASSWORD, password: NEW_PASSWORD }).expect(204);

    await getCurrentSession(app, tokenA).expect(200);
    expect((await getCurrentSession(app, tokenB).expect(401)).body).toMatchObject({ code: 'UNAUTHENTICATED' });
    await postLogin(app, email, NEW_PASSWORD).expect(201);
    expect((await postLogin(app, email, TEST_PASSWORD).expect(401)).body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('a senha atual vazia é entrada inválida e não conta como falha', async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const refused = await changePassword(token, { currentPassword: '', password: NEW_PASSWORD }).expect(400);
      expect(refused.body).toMatchObject({
        code: 'INVALID_INPUT',
        fields: { currentPassword: 'Informe a senha atual.' },
      });
    }
    await postLogin(app, email, TEST_PASSWORD).expect(201);
  });

  it('cinco erros da senha atual bloqueiam a troca e o login do e-mail', async () => {
    const email = uniqueEmail();
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const token = await loginAs(app, email, TEST_PASSWORD);

    for (let failure = 1; failure <= 5; failure += 1) {
      await changePassword(token, { currentPassword: 'senha-errada-000', password: NEW_PASSWORD }).expect(422);
    }
    const blockedChange = await changePassword(token, { currentPassword: TEST_PASSWORD, password: NEW_PASSWORD });
    const blockedLogin = await postLogin(app, email, TEST_PASSWORD);

    expect(blockedChange.status).toBe(429);
    expect(blockedChange.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    expect(blockedLogin.status).toBe(429);
    expect(blockedLogin.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
  });
});
