import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiError, Operation, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import {
  Entity,
  EntityActivation,
  EntityEdit,
  EntityId,
  EntityListQuery,
  EntityOperationParams,
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

const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: a entidade não existe.' };
const VERSION_CONFLICT_RESPONSE = {
  type: ApiError,
  description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: a entidade mudou desde a leitura (regra 6.20).',
};
const INVALID_OPERATION_PARAMS_RESPONSE = {
  type: ApiError,
  description: '`INVALID_INPUT`: o id não é um UUID, ou a operação não é conhecida (em `fields`).',
};

// Até o KAN-13, as rotas pedem só a sessão: todo usuário vê e altera todas as entidades (regra 6.1).
// Elas não leem o Financial-Context, porque cadastram as entidades de que o contexto é feito.
@ApiTags('entities')
@ApiBearerAuth('session')
@Controller('entities')
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as entidades.' })
  @ApiOkResponse({
    type: Entity,
    isArray: true,
    description:
      'Todas as entidades do filtro, numa lista inteira, sem `cursor` (LLD, seção 5): as ativas primeiro, e cada grupo pelo nome, em ordem alfabética.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o `active` não é `true` nem `false` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  list(@Query() query: EntityListQuery): Promise<Entity[]> {
    return this.entities.list(query.active === undefined ? undefined : query.active === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma entidade.' })
  @ApiCreatedResponse({
    type: Entity,
    description: 'A entidade foi criada, ativa, na versão 1, com as operações pedidas ligadas.',
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
  @ApiOperation({ summary: 'Lê uma entidade.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Entity, description: 'A entidade, ativa ou desativada.' })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  get(@Param() params: EntityId): Promise<Entity> {
    return this.entities.get(params.id);
  }

  @Put(':id')
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
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
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
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  setActive(@Param() params: EntityId, @Body() body: EntityActivation): Promise<Entity> {
    return this.entities.setActive(params.id, body.active, body.version);
  }

  @Put(':id/operations/:operation')
  @ApiOperation({ summary: 'Liga uma operação numa empresa.' })
  @ApiParam(ID_PARAM)
  @ApiParam(OPERATION_PARAM)
  @ApiOkResponse({
    type: Entity,
    description: 'A entidade com a operação ligada. Ligar uma operação já ligada responde igual, sem mudar nada.',
  })
  @ApiBadRequestResponse(INVALID_OPERATION_PARAMS_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`OPERATION_REQUIRES_COMPANY`: a entidade é uma pessoa física (regra 6.2).',
  })
  enableOperation(@Param() params: EntityOperationParams): Promise<Entity> {
    return this.entities.enableOperation(params.id, params.operation);
  }

  @Delete(':id/operations/:operation')
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
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  disableOperation(@Param() params: EntityOperationParams): Promise<Entity> {
    return this.entities.disableOperation(params.id, params.operation);
  }
}
