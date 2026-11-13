import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiError, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { FinancialGroup, FinancialGroupEdit, FinancialGroupId, NewFinancialGroup } from './financial-groups.dto.js';
import { FinancialGroupsService } from './financial-groups.service.js';

/** O parâmetro do id do grupo, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id do grupo.' } as const;

const INVALID_ID_RESPONSE = { type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' };
const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: o grupo não existe.' };
const MEMBER_REFUSALS =
  '`INACTIVE_ENTITY`: uma entidade desativada entraria no grupo (regra 6.2). `ENTITY_NOT_FOUND`: um dos ids não é de nenhuma entidade.';
const INVALID_MEMBERS = 'ou os membros faltam, não são uma lista de UUIDs ou se repetem (em `fields`).';

// Até o KAN-13, as rotas pedem só a sessão, como as de entidades. Elas não leem o Financial-Context,
// porque os grupos são parte do que o contexto escolhe.
@ApiTags('financial-groups')
@ApiBearerAuth('session')
@Controller('financial-groups')
export class FinancialGroupsController {
  constructor(private readonly groups: FinancialGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os grupos financeiros.' })
  @ApiOkResponse({
    type: FinancialGroup,
    isArray: true,
    description:
      'Todos os grupos, numa lista inteira, sem `cursor` (LLD, seção 5): a Visão Familiar primeiro, e os outros pelo nome, em ordem alfabética.',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  list(): Promise<FinancialGroup[]> {
    return this.groups.list();
  }

  @Post()
  @ApiOperation({ summary: 'Cria um grupo financeiro.' })
  @ApiCreatedResponse({ type: FinancialGroup, description: 'O grupo foi criado, na versão 1, com os membros pedidos.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description: `\`INVALID_INPUT\`: o nome falta, é vazio ou passa de 120 caracteres, ${INVALID_MEMBERS}`,
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiUnprocessableEntityResponse({ type: ApiError, description: MEMBER_REFUSALS })
  create(@Body() body: NewFinancialGroup): Promise<FinancialGroup> {
    return this.groups.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lê um grupo financeiro.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: FinancialGroup, description: 'O grupo, com os membros.' })
  @ApiBadRequestResponse(INVALID_ID_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  get(@Param() params: FinancialGroupId): Promise<FinancialGroup> {
    return this.groups.get(params.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita o nome e os membros de um grupo financeiro.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: FinancialGroup, description: 'O grupo com o nome e os membros novos, na versão seguinte.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description: `\`INVALID_INPUT\`: o id não é um UUID, a versão falta, o nome falta, é vazio ou passa de 120 caracteres, ${INVALID_MEMBERS}`,
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse({
    type: ApiError,
    description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: o grupo mudou desde a leitura (regra 6.20).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: `\`FAMILY_VIEW_PROTECTED\`: o nome enviado não é o da Visão Familiar, que não é renomeada (regra 6.2). \`FAMILY_VIEW_INDIVIDUALS_ONLY\`: uma pessoa jurídica entraria na Visão Familiar (regra 6.2). ${MEMBER_REFUSALS}`,
  })
  update(@Param() params: FinancialGroupId, @Body() body: FinancialGroupEdit): Promise<FinancialGroup> {
    return this.groups.update(params.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui um grupo financeiro.' })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({
    description: 'O grupo e os membros dele foram excluídos. As entidades e os números delas não mudam (regra 6.2).',
  })
  @ApiBadRequestResponse(INVALID_ID_RESPONSE)
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`FAMILY_VIEW_PROTECTED`: a Visão Familiar não é excluída (regra 6.2).',
  })
  remove(@Param() params: FinancialGroupId): Promise<void> {
    return this.groups.remove(params.id);
  }
}
