import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiError, PageQuery, pageRequest, Public, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { ApiClientHeaders } from './client-headers.js';
import { CurrentSession, Login, SessionId, SessionPage, SessionToken } from './identity.dto.js';
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
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  current(@CurrentSessionOf() session: AuthenticatedSession): CurrentSession {
    return { user: session.user, expiresAt: session.expiresAt };
  }

  @Get()
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'As sessões ativas do usuário.' })
  @ApiOkResponse({
    type: SessionPage,
    description:
      'A página das sessões ativas do usuário da sessão corrente, e só dele, com o total (LLD, seção 5): a corrente primeiro, depois as outras do último uso mais recente ao mais antigo.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  list(@Query() query: PageQuery, @CurrentSessionOf() session: AuthenticatedSession): Promise<SessionPage> {
    return this.sessions.listActive(session.user.id, session.id, pageRequest(query));
  }

  // Declarada antes da ':id', para o caminho "current" não ser lido como um id.
  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Sai: encerra a sessão corrente.' })
  @ApiNoContentResponse({ description: 'A sessão corrente foi encerrada: o token dela não vale mais.' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  endCurrent(@CurrentSessionOf() session: AuthenticatedSession): Promise<void> {
    return this.sessions.endCurrent(session);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Encerra uma sessão ativa do próprio usuário.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'O id da sessão, como a lista de sessões o devolve.' })
  @ApiNoContentResponse({ description: 'A sessão foi encerrada na hora: o token dela não vale mais.' })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse({
    type: ApiError,
    description:
      '`NOT_FOUND`: a sessão não existe, é de outro usuário ou já não está ativa. A resposta é a mesma nos três casos.',
  })
  end(@Param() params: SessionId, @CurrentSessionOf() session: AuthenticatedSession): Promise<void> {
    return this.sessions.end(session.user.id, params.id);
  }
}
