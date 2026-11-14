import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONFIG, type Config, PrismaService } from '../src/common/index.js';
import {
  authedRequest,
  buildTestApp,
  getCurrentSession,
  linkTokenOf,
  loginAs,
  newSession,
  newSessionByRoute,
  newUserByRoute,
  postLogin,
  redeemLink,
  TEST_PASSWORD,
  TestClock,
  uniqueEmail,
  uniqueName,
  uniqueOrigin,
  uniquePrefix,
  type User,
} from './support/app.js';

/** Uma entidade, como o contrato a descreve, só com o que os testes leem. */
interface Entity {
  readonly id: string;
  readonly name: string;
}

describe('Usuários', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão e, quando dado, o identificador da requisição. */
  function authed(token: string, method: 'get' | 'post' | 'put' | 'delete', url: string, requestId?: string) {
    return authedRequest(app, token, method, url, requestId);
  }

  /** Cadastra uma pessoa física com o token e devolve a entidade. */
  async function newEntity(token: string, prefix = 'Ana'): Promise<Entity> {
    const response = await authed(token, 'post', '/v1/entities')
      .send({ type: 'individual', name: uniqueName(prefix) })
      .expect(201);
    return response.body as Entity;
  }

  /** O pedido de ler o usuário. */
  function getUser(token: string, id: string) {
    return authed(token, 'get', `/v1/users/${id}`);
  }

  it('cadastra um usuário, que recebe o link para definir a senha', { tags: ['@KAN-13-CA1'] }, async () => {
    const manager = await newSession(app);
    const entity = await newEntity(manager);
    const email = uniqueEmail();
    const name = uniqueName('Bruno');
    const origin = uniqueOrigin();

    const created = await authed(manager, 'post', '/v1/users')
      .send({
        name: `  ${name} `,
        email: email.toUpperCase(),
        managesAccess: false,
        permissions: [{ entityId: entity.id, level: 'view' }],
      })
      .expect(201);

    const body = created.body as { user: User; recoveryLink: { url: string; expiresAt: string } };
    expect(typeof body.user.id).toBe('string');
    expect(body.user).toEqual({
      id: body.user.id,
      name,
      email,
      managesAccess: false,
      active: true,
      passwordSet: false,
      version: 1,
    });
    const prefix = `${app.get<Config>(CONFIG).publicUrl}/set-password/`;
    expect(body.recoveryLink.url.startsWith(prefix)).toBe(true);
    const token = linkTokenOf(body.recoveryLink.url);
    expect(new Date(body.recoveryLink.expiresAt).getTime()).toBe(clock.now().getTime() + 60 * 60 * 1000);

    const found = await request(app.getHttpServer())
      .get(`/v1/recovery-links/${token}`)
      .set('X-Forwarded-For', origin)
      .expect(200);
    expect(found.body).toEqual({ email });
    await redeemLink(app, token, TEST_PASSWORD, { origin }).expect(201);
    const read = await getUser(manager, body.user.id).expect(200);
    expect(read.body).toMatchObject({ id: body.user.id, passwordSet: true });

    const duplicate = await authed(manager, 'post', '/v1/users')
      .send({ name: uniqueName('Repetido'), email, managesAccess: false })
      .expect(422);
    const missingEntityEmail = uniqueEmail();
    const missingEntity = await authed(manager, 'post', '/v1/users')
      .send({
        name: uniqueName('Sem entidade'),
        email: missingEntityEmail,
        managesAccess: false,
        permissions: [{ entityId: randomUUID(), level: 'view' }],
      })
      .expect(422);

    expect(duplicate.body).toMatchObject({ code: 'DUPLICATE_EMAIL' });
    expect(missingEntity.body).toMatchObject({ code: 'ENTITY_NOT_FOUND' });
    const listed = await authed(manager, 'get', '/v1/users').query({ q: missingEntityEmail }).expect(200);
    expect(listed.body).toMatchObject({ items: [], total: 0 });
    const sameEmail = await authed(manager, 'get', '/v1/users').query({ q: email }).expect(200);
    expect((sameEmail.body as { items: User[] }).items.map((user) => user.id)).toEqual([body.user.id]);
  });

  /** O pedido de desativar ou reativar o usuário, com a versão. */
  function setActive(token: string, id: string, active: boolean, version: number, requestId?: string) {
    return authed(token, 'put', `/v1/users/${id}/active`, requestId).send({ active, version });
  }

  it('desativar um usuário encerra as sessões dele', { tags: ['@KAN-13-CA2'] }, async () => {
    const manager = await newSession(app);
    const { user, token: first } = await newSessionByRoute(app, manager);
    const second = await loginAs(app, user.email);

    const deactivated = await setActive(manager, user.id, false, user.version + 1).expect(200);

    expect(deactivated.body).toMatchObject({ id: user.id, active: false, version: user.version + 2 });
    for (const token of [first, second]) {
      const session = await getCurrentSession(app, token).expect(401);
      expect(session.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    }
    const login = await postLogin(app, user.email, TEST_PASSWORD).expect(401);
    expect(login.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });

    const managerUser = (await getCurrentSession(app, manager).expect(200)).body as { user: { id: string } };
    const self = await getUser(manager, managerUser.user.id).expect(200);
    const refused = await setActive(manager, managerUser.user.id, false, (self.body as User).version).expect(422);
    expect(refused.body).toMatchObject({ code: 'SELF_ACCESS_CHANGE' });
    await getCurrentSession(app, manager).expect(200);
  });

  it('quem não gere acessos tem as rotas de usuários recusadas', { tags: ['@KAN-13-CA5'] }, async () => {
    const manager = await newSession(app);
    const entity = await newEntity(manager);
    const { token } = await newSessionByRoute(app, manager);
    const { user: target } = await newSessionByRoute(app, manager, {
      name: uniqueName('Alvo'),
      permissions: [{ entityId: entity.id, level: 'view' }],
    });
    const before = (await getUser(manager, target.id).expect(200)).body as User;
    const newEmail = uniqueEmail();
    const prisma = app.get(PrismaService);
    const linksOf = () => prisma.recoveryLink.count({ where: { userId: target.id } });
    const linksBefore = await linksOf();

    const refused = [
      await authed(token, 'get', '/v1/users'),
      await getUser(token, target.id),
      await authed(token, 'get', `/v1/users/${target.id}/permissions`),
      await authed(token, 'post', '/v1/users').send({ name: uniqueName('Novo'), email: newEmail, managesAccess: true }),
      await authed(token, 'put', `/v1/users/${target.id}`).send({
        version: before.version,
        name: uniqueName('Outro'),
        email: uniqueEmail(),
      }),
      await setActive(token, target.id, false, before.version),
      await authed(token, 'put', `/v1/users/${target.id}/access`).send({
        version: before.version,
        managesAccess: true,
        permissions: [{ entityId: entity.id, level: 'operate' }],
      }),
      await authed(token, 'post', `/v1/users/${target.id}/recovery-links`),
    ];

    for (const response of refused) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    }
    expect((await getUser(manager, target.id).expect(200)).body).toEqual(before);
    expect(await linksOf()).toBe(linksBefore);
    const permissions = await authed(manager, 'get', `/v1/users/${target.id}/permissions`)
      .query({ q: entity.name })
      .expect(200);
    expect(permissions.body).toMatchObject({ total: 1, items: [{ entityId: entity.id, level: 'view' }] });
    const created = await authed(manager, 'get', '/v1/users').query({ q: newEmail }).expect(200);
    expect(created.body).toMatchObject({ total: 0 });
  });

  it('as mudanças de usuários e permissões ficam na auditoria', { tags: ['@KAN-13-CA7'] }, async () => {
    const manager = await newSession(app);
    const managerId = ((await getCurrentSession(app, manager).expect(200)).body as { user: { id: string } }).user.id;
    const [first, second] = [await newEntity(manager), await newEntity(manager)];
    const requestIds = Array.from({ length: 7 }, () => randomUUID());
    const [name, newName] = [uniqueName('Bruno'), uniqueName('Bruno Novo')];

    const created = await authed(manager, 'post', '/v1/users', requestIds[0])
      .send({ name, email: uniqueEmail(), managesAccess: false, permissions: [{ entityId: first.id, level: 'view' }] })
      .expect(201);
    const { user, recoveryLink } = created.body as { user: User; recoveryLink: { url: string } };
    await authed(manager, 'put', `/v1/users/${user.id}`, requestIds[1])
      .send({ version: 1, name: newName, email: user.email })
      .expect(200);
    await authed(manager, 'put', `/v1/users/${user.id}/access`, requestIds[2])
      .send({
        version: 2,
        managesAccess: true,
        permissions: [
          { entityId: first.id, level: 'operate' },
          { entityId: second.id, level: 'view' },
        ],
      })
      .expect(200);
    await authed(manager, 'put', `/v1/users/${user.id}/access`, requestIds[3])
      .send({ version: 3, managesAccess: true, permissions: [{ entityId: second.id, level: 'none' }] })
      .expect(200);
    const generated = await authed(manager, 'post', `/v1/users/${user.id}/recovery-links`, requestIds[4]).expect(201);
    await setActive(manager, user.id, false, 4, requestIds[5]).expect(200);
    await setActive(manager, user.id, true, 5, requestIds[6]).expect(200);

    const prisma = app.get(PrismaService);
    const common = { userId: managerId };
    const userAudit = await prisma.auditLog.findMany({
      where: { tableName: 'user', recordId: user.id },
      orderBy: { id: 'asc' },
    });
    expect(userAudit).toMatchObject([
      { ...common, action: 'create', requestId: requestIds[0], entityId: null, before: null, after: { name } },
      { ...common, action: 'update', requestId: requestIds[1], before: { name }, after: { name: newName } },
      {
        ...common,
        action: 'update',
        requestId: requestIds[2],
        before: { managesAccess: false, version: 2 },
        after: { managesAccess: true, version: 3 },
      },
      { ...common, action: 'update', requestId: requestIds[3], before: { version: 3 }, after: { version: 4 } },
      { ...common, action: 'update', requestId: requestIds[5], before: { active: true }, after: { active: false } },
      { ...common, action: 'update', requestId: requestIds[6], before: { active: false }, after: { active: true } },
    ]);
    const permissionAudit = (entityId: string) =>
      prisma.auditLog.findMany({ where: { tableName: 'permission', entityId }, orderBy: { id: 'asc' } });
    const firstAudit = await permissionAudit(first.id);
    const ofUser = (entries: typeof firstAudit) =>
      entries.filter((entry) => ((entry.after ?? entry.before) as { userId?: string }).userId === user.id);
    expect(ofUser(firstAudit)).toMatchObject([
      { ...common, action: 'create', requestId: requestIds[0], before: null, after: { level: 'view' } },
      { ...common, action: 'update', requestId: requestIds[2], before: { level: 'view' }, after: { level: 'operate' } },
    ]);
    expect(ofUser(await permissionAudit(second.id))).toMatchObject([
      { ...common, action: 'create', requestId: requestIds[2], before: null, after: { level: 'view' } },
      { ...common, action: 'delete', requestId: requestIds[3], before: { level: 'view' }, after: null },
    ]);
    const links = await prisma.recoveryLink.findMany({ where: { userId: user.id } });
    const linkAudit = await prisma.auditLog.findMany({
      where: { tableName: 'recovery_link', recordId: { in: links.map((link) => link.id) } },
      orderBy: { id: 'asc' },
    });
    expect(linkAudit).toMatchObject([
      { ...common, action: 'create', requestId: requestIds[0] },
      { ...common, action: 'create', requestId: requestIds[4] },
    ]);

    const recorded = JSON.stringify([...userAudit, ...firstAudit, ...linkAudit], (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    const tokens = [recoveryLink.url, (generated.body as { url: string }).url].map((url) => url.split('/').pop());
    for (const secret of [...tokens, ...links.map((link) => link.tokenHash)]) {
      expect(secret).toBeTruthy();
      expect(recorded).not.toContain(secret);
    }
    expect(recorded).not.toContain('passwordHash');
    expect(recorded).not.toContain('tokenHash');
  });

  it('edita o nome e o e-mail, e a troca de e-mail encerra as sessões', { tags: ['@KAN-13-CA8'] }, async () => {
    const manager = await newSession(app);
    const { user, token } = await newSessionByRoute(app, manager);
    const read = (await getUser(manager, user.id).expect(200)).body as User;
    const newName = uniqueName('Bruno Novo');
    const newEmail = uniqueEmail();

    const renamed = await authed(manager, 'put', `/v1/users/${user.id}`)
      .send({ version: read.version, name: newName, email: user.email })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: newName, email: user.email, version: read.version + 1 });
    await getCurrentSession(app, token).expect(200);

    const changed = await authed(manager, 'put', `/v1/users/${user.id}`)
      .send({ version: read.version + 1, name: newName, email: newEmail })
      .expect(200);
    expect(changed.body).toMatchObject({ email: newEmail, version: read.version + 2 });
    const ended = await getCurrentSession(app, token).expect(401);
    expect(ended.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    const oldLogin = await postLogin(app, user.email, TEST_PASSWORD).expect(401);
    expect(oldLogin.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await postLogin(app, newEmail, TEST_PASSWORD).expect(201);

    const stale = await authed(manager, 'put', `/v1/users/${user.id}`)
      .send({ version: read.version, name: uniqueName('Velho'), email: newEmail })
      .expect(409);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT' });
    const { user: other } = await newSessionByRoute(app, manager);
    const duplicate = await authed(manager, 'put', `/v1/users/${user.id}`)
      .send({ version: read.version + 2, name: newName, email: other.email })
      .expect(422);
    expect(duplicate.body).toMatchObject({ code: 'DUPLICATE_EMAIL' });
  });

  it('reativa o usuário com as permissões que tinha', { tags: ['@KAN-13-CA9'] }, async () => {
    const manager = await newSession(app);
    const entity = await newEntity(manager);
    const { user } = await newSessionByRoute(app, manager, { permissions: [{ entityId: entity.id, level: 'view' }] });
    const read = (await getUser(manager, user.id).expect(200)).body as User;
    await setActive(manager, user.id, false, read.version).expect(200);

    const inactiveLink = await authed(manager, 'post', `/v1/users/${user.id}/recovery-links`).expect(422);
    expect(inactiveLink.body).toMatchObject({ code: 'INACTIVE_USER' });
    const reactivated = await setActive(manager, user.id, true, read.version + 1).expect(200);

    expect(reactivated.body).toMatchObject({ active: true, version: read.version + 2 });
    const token = await loginAs(app, user.email);
    await authed(token, 'get', `/v1/entities/${entity.id}`).expect(200);
    const permissions = await authed(manager, 'get', `/v1/users/${user.id}/permissions`)
      .query({ q: entity.name })
      .expect(200);
    expect(permissions.body).toMatchObject({ total: 1, items: [{ entityId: entity.id, level: 'view' }] });
  });

  it('pagina os usuários e busca pelo nome e pelo e-mail', { tags: ['@KAN-13-CA10'] }, async () => {
    const manager = await newSession(app);
    const prefix = uniquePrefix();
    // Os nomes em ordem alfabética: o com acento ("Élcio") fica entre "Davi" e "Fábio".
    const names = ['Ana', 'Bia', 'Caio', 'Davi', 'Élcio', 'Fábio', 'Gil', 'Hugo', 'Iara', 'João', 'Lia'];
    const active: User[] = [];
    for (const name of names) {
      active.push((await newUserByRoute(app, manager, { name: `${prefix} ${name}` })).user);
    }
    const { user: inactive } = await newUserByRoute(app, manager, { name: `${prefix} Aaron` });
    await setActive(manager, inactive.id, false, inactive.version).expect(200);
    const emailOnly = (
      await newUserByRoute(app, manager, { name: uniqueName('Zeca'), email: `${prefix}-zeca@exemplo.com` })
    ).user;

    const pages = [];
    for (const page of ['1', '2', '3']) {
      const response = await authed(manager, 'get', '/v1/users').query({ q: prefix, page, pageSize: '5' }).expect(200);
      pages.push(response.body as { items: User[]; total: number; page: number; pageSize: number });
    }

    expect(pages[0]).toMatchObject({ total: 13, page: 1, pageSize: 5 });
    const ids = pages.flatMap((page) => page.items.map((user) => user.id));
    const expectedActive = [...active.slice(0, 11), emailOnly].sort((a, b) =>
      new Intl.Collator('pt-BR').compare(a.name, b.name),
    );
    expect(ids).toEqual([...expectedActive.map((user) => user.id), inactive.id]);
    expect(pages[2]?.items.at(-1)).toMatchObject({ id: inactive.id, active: false });

    const accent = await authed(manager, 'get', '/v1/users')
      .query({ q: `${prefix} ELCIO` })
      .expect(200);
    expect((accent.body as { items: User[] }).items.map((user) => user.id)).toEqual([active[4]?.id]);
    const byEmail = await authed(manager, 'get', '/v1/users')
      .query({ q: `${prefix}-zeca@` })
      .expect(200);
    expect((byEmail.body as { items: User[] }).items.map((user) => user.id)).toEqual([emailOnly.id]);

    const zero = await authed(manager, 'get', '/v1/users').query({ q: prefix, page: '0' }).expect(400);
    const tooBig = await authed(manager, 'get', '/v1/users').query({ q: prefix, pageSize: '101' }).expect(400);
    expect(zero.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (zero.body as { fields?: { page?: unknown } }).fields?.page).toBe('string');
    expect(tooBig.body).toMatchObject({ code: 'INVALID_INPUT' });
    expect(typeof (tooBig.body as { fields?: { pageSize?: unknown } }).fields?.pageSize).toBe('string');
  });
});
