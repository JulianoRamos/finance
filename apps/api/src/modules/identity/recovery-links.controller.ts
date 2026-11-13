import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiError, Public } from '../../common/index.js';
import { ApiClientHeaders } from './client-headers.js';
import { RecoveryLink, SessionToken, SetPassword } from './identity.dto.js';
import { RecoveryLinksService } from './recovery-links.service.js';
import { originOf, userAgentOf } from './request-origin.js';

const TOKEN_PARAM = { name: 'token', description: 'O token do link de recuperação, como está no link.' };
const NOT_FOUND = { type: ApiError, description: '`NOT_FOUND`: o link não existe, já foi usado ou venceu.' };
const TOO_MANY_ATTEMPTS = {
  type: ApiError,
  description: '`TOO_MANY_ATTEMPTS`: tentativas demais da origem (regra 6.1).',
};

@ApiTags('recovery-links')
@Controller('recovery-links')
@Public()
export class RecoveryLinksController {
  constructor(private readonly recoveryLinks: RecoveryLinksService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Confere um link de recuperação antes de pedir a senha. Rota pública.' })
  @ApiParam(TOKEN_PARAM)
  @ApiClientHeaders({ userAgent: false })
  @ApiOkResponse({ type: RecoveryLink, description: 'O link vale.' })
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiTooManyRequestsResponse(TOO_MANY_ATTEMPTS)
  find(@Param('token') token: string, @Req() request: Request): Promise<RecoveryLink> {
    return this.recoveryLinks.find(token, originOf(request));
  }

  @Post(':token/use')
  @ApiOperation({ summary: 'Usa um link de recuperação: define a senha e entra. Rota pública.' })
  @ApiParam(TOKEN_PARAM)
  @ApiClientHeaders({ userAgent: true })
  @ApiCreatedResponse({
    type: SessionToken,
    description: 'A senha foi definida, as outras sessões do usuário foram encerradas e uma sessão nova foi aberta.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a senha tem menos de 12 ou mais de 256 caracteres, ou a confirmação é diferente (em `fields`).',
  })
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiTooManyRequestsResponse(TOO_MANY_ATTEMPTS)
  use(@Param('token') token: string, @Body() body: SetPassword, @Req() request: Request): Promise<SessionToken> {
    return this.recoveryLinks.use(token, body.password, { origin: originOf(request), userAgent: userAgentOf(request) });
  }
}
