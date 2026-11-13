import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiError, Public } from '../../common/index.js';
import { ApiClientHeaders } from './client-headers.js';
import { CurrentSession, Login, SessionToken } from './identity.dto.js';
import { originOf, userAgentOf } from './request-origin.js';
import { CurrentSessionOf } from './session.guard.js';
import { type AuthenticatedSession, SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Entra com e-mail e senha e abre uma sessão. Rota pública.' })
  @ApiClientHeaders({ userAgent: true })
  @ApiCreatedResponse({ type: SessionToken, description: 'O login abriu a sessão. O token só é devolvido aqui.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o e-mail ou a senha faltam, não são texto ou passam do tamanho máximo.',
  })
  @ApiUnauthorizedResponse({
    type: ApiError,
    description:
      '`INVALID_CREDENTIALS`: o e-mail ou a senha não conferem, ou o usuário está desativado ou sem senha. A mensagem é a mesma em todos os casos.',
  })
  @ApiTooManyRequestsResponse({
    type: ApiError,
    description:
      '`TOO_MANY_ATTEMPTS`: tentativas demais do e-mail ou da origem (regra 6.1). A mensagem não diz se o e-mail existe.',
  })
  create(@Body() body: Login, @Req() request: Request): Promise<SessionToken> {
    return this.sessions.login(body.email, body.password, {
      origin: originOf(request),
      userAgent: userAgentOf(request),
    });
  }

  @Get('current')
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'A sessão corrente e o usuário dela.' })
  @ApiOkResponse({ type: CurrentSession, description: 'A sessão vale. O uso renova o prazo de inatividade.' })
  @ApiUnauthorizedResponse({
    type: ApiError,
    description:
      '`UNAUTHENTICATED`: sem sessão, ou com a sessão encerrada, vencida pelo prazo máximo ou por inatividade.',
  })
  current(@CurrentSessionOf() session: AuthenticatedSession): CurrentSession {
    return { user: session.user, expiresAt: session.expiresAt };
  }
}
