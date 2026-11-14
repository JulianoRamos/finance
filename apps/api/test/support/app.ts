import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../../src/app.js';
import { AppModule } from '../../src/app.module.js';
import { runCommand } from '../../src/cli/commands.js';
import { type Clock, CLOCK } from '../../src/common/index.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Um relógio que só anda quando o teste o avança. Começa no instante real da criação. */
export class TestClock implements Clock {
  private current = new Date();

  now(): Date {
    return new Date(this.current);
  }

  /** Avança o relógio pela duração dada. */
  advance(duration: { days?: number; minutes?: number; seconds?: number }): void {
    const ms = (duration.days ?? 0) * DAY_MS + (duration.minutes ?? 0) * MINUTE_MS + (duration.seconds ?? 0) * 1000;
    this.current = new Date(this.current.getTime() + ms);
  }

  /** Põe o relógio no instante dado. */
  set(at: Date): void {
    this.current = new Date(at);
  }
}

/** A api inteira, com o relógio trocado pelo do teste. */
export async function buildTestApp(clock: TestClock): Promise<INestApplication<Server>> {
  const testingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  const app = testingModule.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();
  return app;
}

/** Um e-mail que nenhum outro teste usa. */
export function uniqueEmail(): string {
  return `ana-${randomUUID()}@exemplo.com`;
}

/** Um nome que nenhum outro teste usa, que começa pelo prefixo dado, para a ordem alfabética. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID()}`;
}

/**
 * Um prefixo que nenhum outro teste usa, para o teste buscar só os registros que criou: o
 * `finance_test` guarda os das execuções anteriores.
 */
export function uniquePrefix(): string {
  return `t${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

/** Uma origem (X-Forwarded-For) que nenhum outro teste usa, para o limite por origem não cruzar testes. */
export function uniqueOrigin(): string {
  return `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}, 172.18.0.1`;
}

/** O que um comando escreveu e o código com que terminou. */
export interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Roda um comando da linha de comando na app de teste, pela mesma função que o executável chama. */
export async function runCommandIn(app: INestApplication, args: readonly string[]): Promise<CommandResult> {
  let stdout = '';
  let stderr = '';
  const code = await runCommand(app, args, {
    out: (line) => (stdout += `${line}\n`),
    err: (line) => (stderr += `${line}\n`),
  });
  return { code, stdout, stderr };
}

/** O token do link de recuperação que um comando imprimiu. */
export function linkTokenOf(stdout: string): string {
  const token = /\/set-password\/([A-Za-z0-9_-]+)$/m.exec(stdout)?.[1];
  if (!token) throw new Error(`O comando não imprimiu um link de recuperação: ${stdout}`);
  return token;
}

/** Cria um usuário pelo comando create-user e devolve o token do link dele. */
export async function newUserLink(app: INestApplication, email: string, name = 'Ana Teste'): Promise<string> {
  const result = await runCommandIn(app, ['create-user', name, email]);
  if (result.code !== 0) throw new Error(`O create-user falhou: ${result.stderr}`);
  return linkTokenOf(result.stdout);
}

/** A senha dos usuários de teste. */
export const TEST_PASSWORD = 'senha-de-teste-123';

/** O pedido de uso do link, de uma origem própria salvo outra dada, para o teste conferir a resposta. */
export function redeemLink(
  app: INestApplication<Server>,
  token: string,
  password: string,
  options: { origin?: string; confirmation?: string } = {},
) {
  return request(app.getHttpServer())
    .post(`/v1/recovery-links/${token}/use`)
    .set('X-Forwarded-For', options.origin ?? uniqueOrigin())
    .send({ password, passwordConfirmation: options.confirmation ?? password });
}

/** O pedido de login, de uma origem própria salvo outra dada, para o teste conferir a resposta. */
export function postLogin(app: INestApplication<Server>, email: string, password: string, origin = uniqueOrigin()) {
  return request(app.getHttpServer()).post('/v1/sessions').set('X-Forwarded-For', origin).send({ email, password });
}

/** Cria um usuário pelo comando create-user e define a senha dele pelo link. */
export async function newUserWithPassword(
  app: INestApplication<Server>,
  email: string,
  password = TEST_PASSWORD,
): Promise<void> {
  await redeemLink(app, await newUserLink(app, email), password).expect(201);
}

/** Entra com o e-mail e a senha e devolve o token da sessão. */
export async function loginAs(app: INestApplication<Server>, email: string, password = TEST_PASSWORD): Promise<string> {
  const response = await postLogin(app, email, password).expect(201);
  return (response.body as { token: string }).token;
}

/** O pedido da sessão corrente com o token, para o teste conferir a resposta. */
export function getCurrentSession(app: INestApplication<Server>, token: string) {
  return request(app.getHttpServer()).get('/v1/sessions/current').auth(token, { type: 'bearer' });
}

/** O token de um usuário novo, criado pelo comando, com a senha definida e a sessão aberta pelo login. */
export async function newSession(app: INestApplication<Server>): Promise<string> {
  const email = uniqueEmail();
  await newUserWithPassword(app, email);
  return loginAs(app, email);
}

/**
 * Um pedido com o token da sessão e, quando dado, o identificador da requisição, que a auditoria
 * grava.
 */
export function authedRequest(
  app: INestApplication<Server>,
  token: string,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  requestId?: string,
) {
  const pending = request(app.getHttpServer())[method](url).auth(token, { type: 'bearer' });
  return requestId ? pending.set('X-Request-Id', requestId) : pending;
}
