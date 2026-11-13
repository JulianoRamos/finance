import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONFIG, type Config, PrismaService } from '../src/common/index.js';
import {
  buildTestApp,
  linkTokenOf,
  loginAs,
  newUserLink,
  newUserWithPassword,
  postLogin,
  redeemLink,
  runCommandIn,
  TEST_PASSWORD,
  TestClock,
  uniqueEmail,
  uniqueOrigin,
} from './support/app.js';

/** O corpo da sessão aberta pelo login ou pelo uso do link. */
interface SessionTokenBody {
  token: string;
  expiresAt: string;
}

describe('Comandos da Identidade', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;
  let linkPattern: RegExp;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await buildTestApp(clock);
    prisma = app.get(PrismaService);
    const { publicUrl } = app.get<Config>(CONFIG);
    linkPattern = new RegExp(
      `^${publicUrl.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/set-password/([A-Za-z0-9_-]{43})$`,
      'm',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('create-user cria o usuário que gere acessos e devolve o link de 1 hora', { tags: ['@KAN-9-CA1'] }, async () => {
    const email = uniqueEmail();
    const origin = uniqueOrigin();
    const server = request(app.getHttpServer());

    const created = await runCommandIn(app, ['create-user', 'Ana Teste', email]);
    const other = await runCommandIn(app, ['create-user', 'Bia Teste', uniqueEmail()]);
    expect(created.code).toBe(0);
    expect(other.code).toBe(0);
    expect(created.stdout).toMatch(linkPattern);
    const token = linkTokenOf(created.stdout);
    const otherToken = linkTokenOf(other.stdout);

    clock.advance({ minutes: 59 });
    const link = await server.get(`/v1/recovery-links/${token}`).set('X-Forwarded-For', origin).expect(200);
    expect(link.body).toEqual({ email });
    await redeemLink(app, token, TEST_PASSWORD, { origin }).expect(201);
    const login = await postLogin(app, email, TEST_PASSWORD, origin).expect(201);
    const current = await server
      .get('/v1/sessions/current')
      .auth((login.body as SessionTokenBody).token, { type: 'bearer' })
      .expect(200);
    expect((current.body as { user: unknown }).user).toMatchObject({ name: 'Ana Teste', email, managesAccess: true });

    clock.advance({ minutes: 2 });
    const expired = await server.get(`/v1/recovery-links/${otherToken}`).set('X-Forwarded-For', origin).expect(404);
    expect(expired.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('create-user recusa um e-mail que já existe', { tags: ['@KAN-9-CA1'] }, async () => {
    const email = uniqueEmail();
    await runCommandIn(app, ['create-user', 'Ana Teste', email]);

    const repeated = await runCommandIn(app, ['create-user', 'Outra Ana', email.toUpperCase()]);

    expect(repeated.code).not.toBe(0);
    expect(repeated.stdout).not.toMatch(linkPattern);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it('recover-access gera o link, e usá-lo encerra as sessões', { tags: ['@KAN-9-CA7'] }, async () => {
    const email = uniqueEmail();
    const newPassword = 'senha-nova-de-teste';
    await newUserWithPassword(app, email, TEST_PASSWORD);
    const sessions = [await loginAs(app, email, TEST_PASSWORD), await loginAs(app, email, TEST_PASSWORD)];
    const server = request(app.getHttpServer());

    const recovered = await runCommandIn(app, ['recover-access', email]);
    expect(recovered.code).toBe(0);
    const used = await redeemLink(app, linkTokenOf(recovered.stdout), newPassword).expect(201);

    for (const token of sessions) {
      await server.get('/v1/sessions/current').auth(token, { type: 'bearer' }).expect(401);
    }
    await server
      .get('/v1/sessions/current')
      .auth((used.body as SessionTokenBody).token, { type: 'bearer' })
      .expect(200);
    const refused = await postLogin(app, email, TEST_PASSWORD).expect(401);
    expect(refused.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('recover-access recusa um e-mail sem usuário', { tags: ['@KAN-9-CA7'] }, async () => {
    const result = await runCommandIn(app, ['recover-access', uniqueEmail()]);

    expect(result.code).not.toBe(0);
    expect(result.stdout).not.toMatch(/set-password/);
    expect(result.stderr).not.toBe('');
  });

  it(
    'grava a criação do usuário e a definição da senha na auditoria, sem a senha',
    { tags: ['@KAN-9-CA8'] },
    async () => {
      const email = uniqueEmail();
      const created = await runCommandIn(app, ['create-user', 'Ana Teste', email]);
      const token = linkTokenOf(created.stdout);
      await redeemLink(app, token, TEST_PASSWORD).expect(201);

      const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { recoveryLinks: true } });
      const userAudit = await prisma.auditLog.findMany({
        where: { tableName: 'user', recordId: user.id },
        orderBy: { id: 'asc' },
      });
      const linkAudit = await prisma.auditLog.findMany({
        where: { tableName: 'recovery_link', recordId: { in: user.recoveryLinks.map((link) => link.id) } },
      });

      expect(userAudit).toMatchObject([
        { action: 'create', before: null, after: { name: 'Ana Teste', email, managesAccess: true } },
        { action: 'update', before: { email }, after: { email } },
      ]);
      for (const entry of userAudit) {
        expect(entry.before ?? {}).not.toHaveProperty('passwordHash');
        expect(entry.after ?? {}).not.toHaveProperty('passwordHash');
      }
      expect(linkAudit.map((entry) => entry.action).sort()).toEqual(['create', 'update']);
      const recorded = JSON.stringify([...userAudit, ...linkAudit], (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      const secrets = [
        TEST_PASSWORD,
        user.passwordHash ?? '',
        token,
        ...user.recoveryLinks.map((link) => link.tokenHash),
      ];
      for (const secret of secrets) {
        expect(secret).not.toBe('');
        expect(recorded).not.toContain(secret);
      }
    },
  );

  it('recover-access recusa um usuário desativado', async () => {
    const email = uniqueEmail();
    await newUserLink(app, email);
    await prisma.user.update({ where: { email }, data: { active: false } });

    const result = await runCommandIn(app, ['recover-access', email]);

    expect(result.code).toBe(1);
    expect(result.stdout).not.toMatch(/set-password/);
    expect(result.stderr).toMatch(/desativado/);
  });
});
