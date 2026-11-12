import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import type { Transaction } from './transaction.service.js';

/**
 * O contexto da requisição (LLD, seção 3): o que vale para todo o comando que ela dispara, sem passar
 * de função em função.
 */
export interface RequestContext {
  /** O identificador da requisição (LLD, seção 5), que vai para a auditoria. */
  readonly requestId: string;
  /** O usuário da requisição. Nulo até a autenticação o definir, e num comando no servidor. */
  userId: string | null;
  /** A transação aberta pelo comando, ou nula fora de uma. */
  readonly transaction: Transaction | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** O contexto da requisição corrente, ou undefined fora de uma. */
export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Roda a função num contexto. O contexto anterior volta quando ela termina. */
export function runInRequestContext<T>(context: RequestContext, run: () => T): T {
  return storage.run(context, run);
}

/**
 * Define o usuário da requisição corrente. É o que a autenticação faz ao reconhecer a sessão, antes do
 * comando: dentro da transação, o contexto é uma cópia, e o usuário definido nele se perderia.
 */
export function setCurrentUser(userId: string | null): void {
  const context = storage.getStore();
  if (!context) throw new Error('Não há contexto da requisição para receber o usuário.');
  if (context.transaction) throw new Error('O usuário da requisição é definido antes de abrir a transação.');
  context.userId = userId;
}

/** O cabeçalho do identificador da requisição (LLD, seção 5). */
export const REQUEST_ID_HEADER = 'X-Request-Id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O identificador recebido, quando ele é um UUID, ou um novo, gerado pela api. */
function requestIdOf(request: Request): string {
  const received = request.header(REQUEST_ID_HEADER);
  return received !== undefined && UUID.test(received) ? received : randomUUID();
}

/** Abre o contexto de cada requisição, registrado no configureApp. */
export function requestContextMiddleware(request: Request, _response: Response, next: NextFunction): void {
  const requestId = requestIdOf(request);
  runInRequestContext({ requestId, userId: null, transaction: null }, next);
}
