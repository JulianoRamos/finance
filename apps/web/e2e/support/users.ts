import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

import type { BrowserContext } from '@playwright/test';
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

function requiredEnv(name: string): string {
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

/** Grava um usuário com e-mail próprio, sem senha, e um link de recuperação dele, que vale 1 hora. */
export async function createPendingTestUser(): Promise<PendingTestUser> {
  const suffix = randomUUID();
  const name = `Ana Teste ${suffix.slice(0, 8)}`;
  const email = `e2e-${suffix}@exemplo.com`;
  const token = randomBytes(32).toString('base64url');

  const client = new pg.Client({ connectionString: requiredEnv('E2E_DATABASE_URL') });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO "user" (name, email, created_at, updated_at) VALUES ($1, $2, now(), now()) RETURNING id',
      [name, email],
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
export async function createTestUser(): Promise<TestUser> {
  const { name, email, linkToken: token } = await createPendingTestUser();
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

/** Entra com o usuário no contexto do navegador, pondo a sessão dele no cookie, como o login faz. */
export async function signIn(context: BrowserContext, user: TestUser, baseURL: string): Promise<void> {
  await context.addCookies([
    { name: 'session', value: user.sessionToken, url: baseURL, httpOnly: true, sameSite: 'Lax' },
  ]);
}
