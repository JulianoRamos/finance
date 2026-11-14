import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

import type { BrowserContext, Page } from '@playwright/test';
import pg from 'pg';

// A preparação do usuário dos testes de ponta a ponta. Não há rota pública que crie usuário, e o
// comando create-user roda no contêiner da api, fora do alcance do Playwright: a preparação grava o
// usuário e um link de recuperação no banco de desenvolvimento, com o papel da api (E2E_DATABASE_URL), e
// define a senha pela rota de uso do link, como o usuário faria.

/** Um usuário de teste, com a senha definida e a sessão aberta pelo uso do link. */
export interface TestUser {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly sessionToken: string;
}

/** A variável de ambiente, que o contêiner da web define; sem ela, o teste não roda. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não está definida. Rode os testes no contêiner da web.`);
  return value;
}

/** Uma origem (X-Forwarded-For) só do teste, para o limite de tentativas por origem não cruzar testes. */
export function uniqueOrigin(): string {
  return `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`;
}

/** Um usuário de teste sem senha, com o token de um link de recuperação que vale. */
export interface PendingTestUser {
  readonly name: string;
  readonly email: string;
  readonly linkToken: string;
}

/** O que a preparação do usuário de teste pode mudar: se ele gere acessos (regra 6.1). */
export interface TestUserOptions {
  readonly managesAccess?: boolean;
}

/**
 * Grava um usuário com e-mail próprio, sem senha, e um link de recuperação dele, que vale 1 hora. Por
 * padrão, ele não gere acessos.
 */
export async function createPendingTestUser({ managesAccess = false }: TestUserOptions = {}): Promise<PendingTestUser> {
  const suffix = randomUUID();
  const name = `Ana Teste ${suffix.slice(0, 8)}`;
  const email = `e2e-${suffix}@exemplo.com`;
  const token = randomBytes(32).toString('base64url');

  const client = new pg.Client({ connectionString: requiredEnv('E2E_DATABASE_URL') });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO "user" (name, email, manages_access, created_at, updated_at) VALUES ($1, $2, $3, now(), now()) RETURNING id',
      [name, email, managesAccess],
    );
    await client.query(
      "INSERT INTO recovery_link (user_id, token_hash, created_at, expires_at) VALUES ($1, $2, now(), now() + interval '1 hour')",
      [rows[0]?.id, createHash('sha256').update(token).digest('hex')],
    );
  } finally {
    await client.end();
  }
  return { name, email, linkToken: token };
}

/** Cria um usuário com e-mail próprio e define a senha dele pelo link de recuperação. */
export async function createTestUser(options: TestUserOptions = {}): Promise<TestUser> {
  const { name, email, linkToken: token } = await createPendingTestUser(options);
  const password = 'senha-de-teste-123';
  const response = await fetch(`${requiredEnv('API_URL')}/v1/recovery-links/${token}/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': uniqueOrigin() },
    body: JSON.stringify({ password, passwordConfirmation: password }),
  });
  if (response.status !== 201) {
    throw new Error(`O uso do link do usuário de teste respondeu ${String(response.status)}.`);
  }
  const { token: sessionToken } = (await response.json()) as { token: string };
  return { name, email, password, sessionToken };
}

/** Abre mais uma sessão do usuário pela rota de login da api, de uma origem só do teste. */
export async function openSessionByLogin(user: TestUser): Promise<void> {
  const response = await fetch(`${requiredEnv('API_URL')}/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': uniqueOrigin() },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (response.status !== 201) throw new Error(`O login do usuário de teste respondeu ${String(response.status)}.`);
}

/** Entra com o usuário no contexto do navegador, pondo a sessão dele no cookie, como o login faz. */
export async function signIn(context: BrowserContext, user: TestUser, baseURL: string): Promise<void> {
  await context.addCookies([
    { name: 'session', value: user.sessionToken, url: baseURL, httpOnly: true, sameSite: 'Lax' },
  ]);
}

/** O id do usuário do e-mail, lido pela api com a sessão de quem gere acessos. */
export async function userIdOf(manager: TestUser, email: string): Promise<string> {
  const response = await fetch(`${requiredEnv('API_URL')}/v1/users?q=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${manager.sessionToken}` },
  });
  if (response.status !== 200) throw new Error(`A lista dos usuários respondeu ${String(response.status)}.`);
  const { items } = (await response.json()) as { items: { id: string; email: string }[] };
  const found = items.find((item) => item.email === email);
  if (!found) throw new Error(`A lista dos usuários não trouxe ${email}.`);
  return found.id;
}

/**
 * Entra com um usuário novo que gere acessos e abre, na tela Usuários e acessos, outro usuário novo, com
 * a senha definida, no caminho dado abaixo dele.
 */
export async function openTestUser(page: Page, baseURL: string, subpath = ''): Promise<TestUser> {
  const manager = await createTestUser({ managesAccess: true });
  const user = await createTestUser();
  await signIn(page.context(), manager, baseURL);
  await page.goto(`/users/${await userIdOf(manager, user.email)}${subpath}`);
  return user;
}
