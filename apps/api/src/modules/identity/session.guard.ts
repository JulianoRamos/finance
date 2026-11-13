import { type CanActivate, createParamDecorator, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { apiError, PUBLIC_ROUTE, setCurrentUser } from '../../common/index.js';
import { type AuthenticatedSession, SessionsService } from './sessions.service.js';

/** Onde o guard deixa a sessão reconhecida, na requisição. */
const SESSION_KEY = Symbol('session');

type RequestWithSession = Request & { [SESSION_KEY]?: AuthenticatedSession };

/** O token do Authorization: Bearer, ou nulo sem ele. */
function bearerTokenOf(request: Request): string | null {
  const [scheme, token] = request.header('Authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * A autenticação de toda rota que não é pública (LLD, seção 5): reconhece a sessão do Authorization:
 * Bearer, recusa sem uma válida e põe o usuário no contexto da requisição, antes do comando.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = bearerTokenOf(request);
    const session = token === null ? null : await this.sessions.authenticate(token);
    if (!session) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Sua sessão terminou. Entre de novo.');
    }
    setCurrentUser(session.user.id);
    request[SESSION_KEY] = session;
    return true;
  }
}

/** A sessão que o guard reconheceu, como parâmetro da rota protegida. */
export const CurrentSessionOf = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const session = context.switchToHttp().getRequest<RequestWithSession>()[SESSION_KEY];
  if (!session) throw new Error('A rota pede a sessão, mas é pública: o guard não a reconheceu.');
  return session;
});
