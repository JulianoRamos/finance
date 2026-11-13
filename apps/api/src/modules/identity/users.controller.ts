import { Body, Controller, HttpCode, HttpStatus, Put, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiError, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { ApiClientHeaders } from './client-headers.js';
import { ChangePassword } from './identity.dto.js';
import { PasswordChangeService } from './password-change.service.js';
import { originOf } from './request-origin.js';
import { CurrentSessionOf } from './session.guard.js';
import type { AuthenticatedSession } from './sessions.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly passwordChange: PasswordChangeService) {}

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Troca a senha do usuário da sessão corrente.' })
  @ApiClientHeaders({ userAgent: false })
  @ApiNoContentResponse({
    description:
      'A senha foi trocada e as outras sessões do usuário foram encerradas. A sessão corrente continua aberta.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a senha atual falta, a nova tem menos de 12 ou mais de 256 caracteres, ou a confirmação é diferente (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`INVALID_CURRENT_PASSWORD`: a senha atual não confere. A falha conta no limite de tentativas do e-mail e da origem (regra 6.1).',
  })
  @ApiTooManyRequestsResponse({
    type: ApiError,
    description: '`TOO_MANY_ATTEMPTS`: falhas demais da senha do e-mail ou da origem (regra 6.1).',
  })
  changePassword(
    @Body() body: ChangePassword,
    @CurrentSessionOf() session: AuthenticatedSession,
    @Req() request: Request,
  ): Promise<void> {
    return this.passwordChange.change(session, body, originOf(request));
  }
}
