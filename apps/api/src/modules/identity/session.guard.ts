import { type CanActivate, createParamDecorator, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

import {
  apiError,
  type PermissionLevel,
  PUBLIC_ROUTE,
  REQUIRED_ENTITY_LEVEL,
  setCurrentAccess,
  setCurrentUser,
} from '../../common/index.js';
import { MANAGES_ACCESS } from './manages-access.js';
import { PermissionsService } from './permissions.service.js';
import { type AuthenticatedSession, SessionsService } from './sessions.service.js';

/** Onde o guard deixa a sessão reconhecida, na requisição. */
const SESSION_KEY = Symbol('session');

type RequestWithSession = Request & { [SESSION_KEY]?: AuthenticatedSession };

/** Se o nível do usuário, ou a falta dele, cumpre o nível exigido: `operate` também lê. */
function satisfiesLevel(level: PermissionLevel | undefined, required: PermissionLevel): boolean {
  return level === 'operate' || (level === 'view' && required === 'view');
}

/** A recusa do pedido sem a permissão que a rota exige (regra 6.1). */
function forbidden(message: string) {
  return apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
}

/** O token do Authorization: Bearer, ou nulo sem ele. */
function bearerTokenOf(request: Request): string | null {
  const [scheme, token] = request.header('Authorization')?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * A autenticação de toda rota que não é pública (LLD, seção 5): reconhece a sessão do Authorization:
 * Bearer, recusa sem uma válida e põe o usuário e as permissões dele no contexto da requisição, antes do
 * comando. Depois confere as marcas da rota (regra 6.1): o `@ManagesAccess()` e o nível que o
 * `@RequiresEntityLevel()` exige na entidade do parâmetro `id`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly permissions: PermissionsService,
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
    setCurrentAccess(() => this.permissions.levelsOf(session.user.id));
    request[SESSION_KEY] = session;
    if (this.reflector.get<boolean | undefined>(MANAGES_ACCESS, context.getHandler()) && !session.user.managesAccess) {
      throw forbidden('Só quem gere os acessos usa esta função.');
    }
    const required = this.reflector.get<PermissionLevel | undefined>(REQUIRED_ENTITY_LEVEL, context.getHandler());
    if (!required) return true;
    const entityId = request.params.id;
    // A rota marcada sem o parâmetro `id` é um erro de quem a escreveu: ela não passa sem a conferência.
    if (typeof entityId !== 'string')
      throw new Error('A rota marcada com @RequiresEntityLevel não tem o parâmetro id.');
    // Um id que não é UUID segue para a validação da rota, que responde 400 com o campo.
    if (isUUID(entityId)) {
      const level = (await this.permissions.levelsOf(session.user.id, [entityId])).get(entityId);
      if (!satisfiesLevel(level, required)) {
        throw forbidden(
          required === 'view'
            ? 'Você não tem acesso a esta entidade.'
            : 'Você só pode ver esta entidade, e não alterá-la.',
        );
      }
    }
    return true;
  }
}

/** A sessão que o guard reconheceu, como parâmetro da rota protegida. */
export const CurrentSessionOf = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const session = context.switchToHttp().getRequest<RequestWithSession>()[SESSION_KEY];
  if (!session) throw new Error('A rota pede a sessão, mas é pública: o guard não a reconheceu.');
  return session;
});
