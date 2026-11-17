import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import {
  ApiError,
  currentVisibleEntityIds,
  PageQuery,
  pageRequest,
  RequiresEntityLevel,
  UNAUTHENTICATED_RESPONSE,
} from '../../common/index.js';
import {
  EquityStake,
  EquityStakeCompanyId,
  EquityStakeEnd,
  EquityStakePage,
  EquityStakeParams,
  NewEquityStake,
} from './equity-stakes.dto.js';
import { EquityStakesService } from './equity-stakes.service.js';

/** O parâmetro do id da empresa, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id da empresa.' } as const;

/** O parâmetro do id da participação, como o contrato o descreve. */
const STAKE_ID_PARAM = { name: 'stakeId', format: 'uuid', description: 'O id da participação.' } as const;

const OPERATE_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description:
    '`FORBIDDEN`: o usuário não tem `operate` na empresa (quem só tem `view` só lê), ou ela não existe (regra 6.1).',
};

// As participações ficam sob a empresa, para usar as marcas de permissão da entidade do `id`: `view`
// para a lista e `operate` para o registro e o encerramento, conferidos pela Identidade (regra 6.1).
// Elas não leem o Financial-Context, como as outras rotas do cadastro das entidades.
@ApiTags('entities')
@ApiBearerAuth('session')
@Controller('entities/:id/equity-stakes')
export class EquityStakesController {
  constructor(private readonly stakes: EquityStakesService) {}

  @Get()
  @RequiresEntityLevel('view')
  @ApiOperation({ summary: 'Lista as participações societárias numa empresa.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: EquityStakePage,
    description:
      'A página das participações na empresa, encerradas ou não, com o total (LLD, seção 5): as sem fim primeiro, depois pelo último dia, do mais recente ao mais antigo, e, no empate, pelo início, do mais recente ao mais antigo, e pelo nome do sócio. Numa pessoa física, a página vem vazia.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `view` nem `operate` na empresa, ou ela não existe (regra 6.1).',
  })
  list(@Param() params: EquityStakeCompanyId, @Query() query: PageQuery): Promise<EquityStakePage> {
    return this.stakes.list(params.id, pageRequest(query));
  }

  @Post()
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Registra uma participação societária numa empresa.' })
  @ApiParam(ID_PARAM)
  @ApiCreatedResponse({
    type: EquityStake,
    description: 'A participação foi registrada, na versão 1, e entrou na auditoria.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id ou o `holderId` não é um UUID, a fração não é uma string decimal de mais de 0 até 1 com até 8 casas, o início falta ou não é uma data `AAAA-MM-DD`, ou o fim não é uma data ou vem antes do início (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`EQUITY_STAKE_REQUIRES_COMPANY`: a entidade do caminho é uma pessoa física. `EQUITY_STAKE_SELF`: o sócio é a própria empresa. `ENTITY_NOT_FOUND`: o sócio não existe ou o usuário não tem `view` nem `operate` nele. `INACTIVE_ENTITY`: o sócio está desativado. `EQUITY_STAKE_OVER_LIMIT`: em algum dia do período, a soma das participações vigentes na empresa passaria de 1. `EQUITY_STAKE_CYCLE`: a participação fecharia um ciclo, com a empresa participando, direta ou indiretamente, do sócio (regra 6.2).',
  })
  async create(@Param() params: EquityStakeCompanyId, @Body() body: NewEquityStake): Promise<EquityStake> {
    return this.stakes.create(params.id, body, await currentVisibleEntityIds());
  }

  @Put(':stakeId/end')
  @RequiresEntityLevel('operate')
  @ApiOperation({ summary: 'Encerra uma participação societária.' })
  @ApiParam(ID_PARAM)
  @ApiParam(STAKE_ID_PARAM)
  @ApiOkResponse({
    type: EquityStake,
    description:
      'A participação encerrada, com o último dia e a versão seguinte. Depois desse dia, a fração deixa de contar como vigente, e o registro continua no histórico (regra 6.2).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id ou o `stakeId` não é um UUID, a versão falta, ou o último dia falta, não é uma data `AAAA-MM-DD` ou vem antes do início (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse({
    type: ApiError,
    description: '`NOT_FOUND`: a participação não existe, ou não é desta empresa.',
  })
  @ApiConflictResponse({
    type: ApiError,
    description:
      '`VERSION_CONFLICT`: a `version` enviada não é a atual: a participação mudou desde a leitura (regra 6.20).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`EQUITY_STAKE_ENDED`: a participação já tem o último dia (regra 6.2).',
  })
  end(@Param() params: EquityStakeParams, @Body() body: EquityStakeEnd): Promise<EquityStake> {
    return this.stakes.end(params.id, params.stakeId, body);
  }
}
