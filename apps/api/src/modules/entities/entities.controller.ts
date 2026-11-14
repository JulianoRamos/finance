import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import {
  ApiError,
  currentEntityLevels,
  GrantsCreatorAccess,
  Operation,
  pageRequest,
  RequiresEntityLevel,
  UNAUTHENTICATED_RESPONSE,
} from '../../common/index.js';
import {
  Entity,
  EntityActivation,
  EntityEdit,
  EntityId,
  EntityListQuery,
  EntityOperationParams,
  EntityPage,
  NewEntity,
} from './entities.dto.js';
import { EntitiesService } from './entities.service.js';

/** O parâmetro do id da entidade, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id da entidade.' } as const;
/** O parâmetro da operação, como o contrato o descreve. */
const OPERATION_PARAM = {
  name: 'operation',
  enum: Operation,
  description: 'A operação. Por enquanto, só a de clínica.',
} as const;

const VIEW_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description: '`FORBIDDEN`: o usuário não tem `view` nem `operate` na entidade, ou ela não existe (regra 6.1).',
};
const OPERATE_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description:
    '`FORBIDDEN`: o usuário não tem `operate` na entidade (quem só tem `view` só lê), ou ela não existe (regra 6.1).',
};
const VERSION_CONFLICT_RESPONSE = {
  type: ApiError,
  description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: a entidade mudou desde a leitura (regra 6.20).',
};
const INVALID_OPERATION_PARAMS_RESPONSE = {
  type: ApiError,
  description: '`INVALID_INPUT`: o id não é um UUID, ou a operação não é conhecida (em `fields`).',
};

// As rotas de uma entidade exigem `view` para ler e `operate` para alterar, conferidos pela Identidade
// nas marcas (regra 6.1), e a lista traz só as entidades que o usuário vê. Elas não leem o
// Financial-Context, porque cadastram as entidades de que o contexto é feito.
@ApiTags('entities')
@ApiBearerAuth('session')
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as entidades.' })
  @ApiOkResponse({
    type: EntityPage,
    description:
      'A página das entidades do filtro em que o usuário tem `view` ou `operate`, com o total (LLD, seção 5): as ativas primeiro, e cada grupo pelo nome, em ordem alfabética. As outras não aparecem nem contam no total (regra 6.1).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o `active` não é `true` nem `false`, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  async list(@Query() query: EntityListQuery): Promise<EntityPage> {
    return this.entities.list({
      active: query.active === undefined ? undefined : query.active === 'true',
      ids: [...(await currentEntityLevels()).keys()],
      q: query.q,
      page: pageRequest(query),
    });
  }

  @Post()
  @GrantsCreatorAccess()
  @ApiOperation({ summary: 'Cadastra uma entidade.' })
  @ApiCreatedResponse({
    type: Entity,
    description:
      'A entidade foi criada, ativa, na versão 1, com as operações pedidas ligadas. Quem a cadastra recebe `operate` nela, na mesma transação (regra 6.1).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o tipo falta ou não é conhecido, o nome falta, é vazio ou passa de 120 caracteres, o documento não é um CPF (pessoa física) ou um CNPJ (pessoa jurídica) com os dígitos verificadores certos, ou uma operação não é conhecida ou se repete (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`DUPLICATE_TAX_ID`: o documento já é de outra entidade, ativa ou desativada. `OPERATION_REQUIRES_COMPANY`: a pessoa física veio com uma operação (regra 6.2).',
  })
  create(@Body() body: NewEntity): Promise<Entity> {
    return this.entities.create(body);
  }

  @Get(':id')
  @RequiresEntityLevel('view')
  @ApiOperation({ summary: 'Lê uma entidade.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Entity, description: 'A entidade, ativa ou desativada.' })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(VIEW_FORBIDDEN_RESPONSE)
  get(@Param() params: EntityId): Promise<Entity> {
    return this.entities.get(params.id);
  }

  @Put(':id')
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Edita o nome e o documento de uma entidade.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: Entity,
    description: 'A entidade com os dados novos e a versão seguinte. As operações não mudam por esta rota.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a versão falta, o tipo falta ou não é conhecido, o nome falta, é vazio ou passa de 120 caracteres, ou o documento não é um CPF ou um CNPJ válido para o tipo (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`ENTITY_TYPE_IMMUTABLE`: o tipo enviado não é o da entidade, que não muda depois da criação (regra 6.2). `DUPLICATE_TAX_ID`: o documento já é de outra entidade.',
  })
  update(@Param() params: EntityId, @Body() body: EntityEdit): Promise<Entity> {
    return this.entities.update(params.id, body);
  }

  @Put(':id/active')
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Desativa ou reativa uma entidade.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: Entity,
    description:
      'A entidade desativada ou reativada, com a versão seguinte. Pedir o estado que ela já tem responde 200 sem mudar a versão. Desativar não desliga as operações nem apaga nada (regra 6.2).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o id não é um UUID, ou o `active` ou a versão faltam (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  setActive(@Param() params: EntityId, @Body() body: EntityActivation): Promise<Entity> {
    return this.entities.setActive(params.id, body.active, body.version);
  }

  @Put(':id/operations/:operation')
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Liga uma operação numa empresa.' })
  @ApiParam(ID_PARAM)
  @ApiParam(OPERATION_PARAM)
  @ApiOkResponse({
    type: Entity,
    description: 'A entidade com a operação ligada. Ligar uma operação já ligada responde igual, sem mudar nada.',
  })
  @ApiBadRequestResponse(INVALID_OPERATION_PARAMS_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`OPERATION_REQUIRES_COMPANY`: a entidade é uma pessoa física (regra 6.2).',
  })
  enableOperation(@Param() params: EntityOperationParams): Promise<Entity> {
    return this.entities.enableOperation(params.id, params.operation);
  }

  @Delete(':id/operations/:operation')
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Desliga uma operação numa empresa.' })
  @ApiParam(ID_PARAM)
  @ApiParam(OPERATION_PARAM)
  @ApiOkResponse({
    type: Entity,
    description:
      'A entidade sem a operação. Desligar esconde as funções dela e não apaga nenhum registro (regra 6.2). Desligar uma operação já desligada responde igual, sem mudar nada.',
  })
  @ApiBadRequestResponse(INVALID_OPERATION_PARAMS_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  disableOperation(@Param() params: EntityOperationParams): Promise<Entity> {
    return this.entities.disableOperation(params.id, params.operation);
  }
}
