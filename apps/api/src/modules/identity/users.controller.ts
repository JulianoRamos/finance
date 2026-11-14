import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { ApiError, pageRequest, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { ApiClientHeaders } from './client-headers.js';
import {
  ChangePassword,
  CreatedUser,
  EntityPermissionPage,
  EntityPermissionQuery,
  GeneratedRecoveryLink,
  NewUser,
  User,
  UserAccess,
  UserActivation,
  UserEdit,
  UserId,
  UserListQuery,
  UserPage,
} from './identity.dto.js';
import { IdentityService } from './identity.service.js';
import { MANAGES_ACCESS_FORBIDDEN_RESPONSE, ManagesAccess } from './manages-access.js';
import { PasswordChangeService } from './password-change.service.js';
import { PermissionsService } from './permissions.service.js';
import { originOf } from './request-origin.js';
import { CurrentSessionOf } from './session.guard.js';
import type { AuthenticatedSession } from './sessions.service.js';
import { UsersService } from './users.service.js';

/** O parâmetro do id do usuário, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id do usuário.' } as const;

const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: o usuário não existe.' };
const VERSION_CONFLICT_RESPONSE = {
  type: ApiError,
  description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: o usuário mudou desde a leitura (regra 6.20).',
};
const INVALID_ID_RESPONSE = { type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' };

@ApiTags('users')
@ApiBearerAuth('session')
@Controller('users')
export class UsersController {
  constructor(
    private readonly passwordChange: PasswordChangeService,
    private readonly users: UsersService,
    private readonly permissions: PermissionsService,
    private readonly identity: IdentityService,
  ) {}

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
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

  @Get()
  @ManagesAccess()
  @ApiOperation({ summary: 'Lista os usuários.' })
  @ApiOkResponse({
    type: UserPage,
    description:
      'A página dos usuários do filtro, com o total (LLD, seção 5): os ativos primeiro, e cada grupo pelo nome, em ordem alfabética.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  list(@Query() query: UserListQuery): Promise<UserPage> {
    return this.users.list({ q: query.q, page: pageRequest(query) });
  }

  @Post()
  @ManagesAccess()
  @ApiOperation({ summary: 'Cadastra um usuário e gera o link para ele definir a senha.' })
  @ApiCreatedResponse({
    type: CreatedUser,
    description:
      'O usuário criado, sem senha, e o link de recuperação com que ele a define, que vale 1 hora e uma vez só. O link não é devolvido de novo (regra 6.1).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o nome falta, é vazio ou passa de 120 caracteres, o e-mail não é válido ou passa de 320, ou as permissões não são uma lista de entidades sem repetição, cada uma com `none`, `view` ou `operate` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`DUPLICATE_EMAIL`: o e-mail já é de outro usuário. `ENTITY_NOT_FOUND`: um dos ids das permissões não é de nenhuma entidade.',
  })
  create(@Body() body: NewUser): Promise<CreatedUser> {
    return this.identity.register(body);
  }

  @Get(':id')
  @ManagesAccess()
  @ApiOperation({ summary: 'Lê um usuário.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: User, description: 'O usuário, ativo ou desativado.' })
  @ApiBadRequestResponse(INVALID_ID_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  get(@Param() params: UserId): Promise<User> {
    return this.users.get(params.id);
  }

  @Put(':id')
  @ManagesAccess()
  @ApiOperation({ summary: 'Edita o nome e o e-mail de um usuário.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: User,
    description:
      'O usuário editado, com a versão seguinte. A troca do e-mail encerra todas as sessões dele (regra 6.1).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, ou a versão, o nome ou o e-mail faltam ou não são válidos (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({ type: ApiError, description: '`DUPLICATE_EMAIL`: o e-mail já é de outro usuário.' })
  update(@Param() params: UserId, @Body() body: UserEdit): Promise<User> {
    return this.identity.edit(params.id, body);
  }

  @Put(':id/active')
  @ManagesAccess()
  @ApiOperation({ summary: 'Desativa ou reativa um usuário.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: User,
    description:
      'O usuário desativado ou reativado, com a versão seguinte. Desativar encerra todas as sessões dele na hora; as permissões ficam, e valem de novo na reativação (regra 6.1). Pedir o estado que ele já tem responde 200 sem mudar a versão.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o id não é um UUID, ou o `active` ou a versão faltam (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`SELF_ACCESS_CHANGE`: o usuário da sessão desativaria a si mesmo (regra 6.1).',
  })
  setActive(@Param() params: UserId, @Body() body: UserActivation): Promise<User> {
    return this.identity.setActive(params.id, body.active, body.version);
  }

  @Get(':id/permissions')
  @ManagesAccess()
  @ApiOperation({ summary: 'Lista as permissões de um usuário por entidade.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: EntityPermissionPage,
    description:
      'A página de todas as entidades do filtro, ativas ou não, com o nível do usuário em cada uma, na ordem da lista das entidades: as ativas primeiro, e cada grupo pelo nome. A entidade sem permissão vem com `none`.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  async listPermissions(@Param() params: UserId, @Query() query: EntityPermissionQuery): Promise<EntityPermissionPage> {
    const [, page] = await Promise.all([
      this.users.read(params.id),
      this.permissions.page(params.id, { q: query.q, page: pageRequest(query) }),
    ]);
    return page;
  }

  @Put(':id/access')
  @ManagesAccess()
  @ApiOperation({ summary: 'Grava o gerir acessos e as permissões por entidade de um usuário.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: User,
    description:
      'O usuário com os acessos gravados, com a versão seguinte, mesmo quando só as permissões mudam. As entidades fora da lista não mudam.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a versão ou o `managesAccess` faltam, ou as permissões não são uma lista de entidades sem repetição, cada uma com `none`, `view` ou `operate` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`ENTITY_NOT_FOUND`: um dos ids das permissões não é de nenhuma entidade. `SELF_ACCESS_CHANGE`: o usuário da sessão tiraria de si mesmo o gerir acessos (regra 6.1).',
  })
  setAccess(@Param() params: UserId, @Body() body: UserAccess): Promise<User> {
    return this.identity.setAccess(params.id, body);
  }

  @Post(':id/recovery-links')
  @ManagesAccess()
  @ApiOperation({ summary: 'Gera um link de recuperação para um usuário.' })
  @ApiParam(ID_PARAM)
  @ApiCreatedResponse({
    type: GeneratedRecoveryLink,
    description:
      'O link de recuperação do usuário, que vale 1 hora e uma vez só. Usá-lo define a senha nova e encerra todas as sessões dele (regra 6.1). O link não é devolvido de novo.',
  })
  @ApiBadRequestResponse(INVALID_ID_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(MANAGES_ACCESS_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`INACTIVE_USER`: o usuário está desativado e não entra; ele é reativado antes (regra 6.1).',
  })
  createRecoveryLink(@Param() params: UserId): Promise<GeneratedRecoveryLink> {
    return this.identity.generateRecoveryLink(params.id);
  }
}
