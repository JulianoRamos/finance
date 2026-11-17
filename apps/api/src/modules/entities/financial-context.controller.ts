import { Controller, Get } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  ApiError,
  currentFinancialContext,
  FINANCIAL_CONTEXT_HEADER,
  RequiresFinancialContext,
  UNAUTHENTICATED_RESPONSE,
} from '../../common/index.js';
import { FinancialContext } from './financial-context.dto.js';

// A primeira rota de dados: a Identidade lê o cabeçalho, pede a resolução e confere `view` em cada
// entidade do contexto (regra 6.2), antes de a rota rodar.
@ApiTags('financial-context')
@ApiBearerAuth('session')
@Controller('financial-context')
export class FinancialContextController {
  @Get()
  @RequiresFinancialContext('view')
  @ApiOperation({ summary: 'Lê o contexto financeiro escolhido.' })
  @ApiHeader({
    name: FINANCIAL_CONTEXT_HEADER,
    required: true,
    description: 'O contexto financeiro escolhido (LLD, seção 5): `entity:<id>` ou `group:<id>`, com o id em UUID.',
    schema: { type: 'string', example: 'group:0190d3f2-6c1e-7a4b-9f00-1a2b3c4d5e6f' },
  })
  @ApiOkResponse({
    type: FinancialContext,
    description:
      'O contexto resolvido nas entidades dele (regra 6.2): a própria entidade, ou os membros do grupo, ativos ou não, pelo nome.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o cabeçalho `Financial-Context` falta, ou não é `entity:<id>` nem `group:<id>` com um UUID (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description:
      '`FORBIDDEN`: o usuário não tem `view` nem `operate` numa entidade do contexto, ou o id não é de nenhuma entidade nem de nenhum grupo (regra 6.2).',
  })
  get(): FinancialContext {
    const context = currentFinancialContext();
    return { ...context, entities: [...context.entities] };
  }
}
