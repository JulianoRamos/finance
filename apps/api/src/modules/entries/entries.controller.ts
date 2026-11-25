import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
  currentFinancialContext,
  FINANCIAL_CONTEXT_HEADER,
  PageQuery,
  pageRequest,
  parseCalendarMonth,
  RequiresFinancialContext,
  UNAUTHENTICATED_RESPONSE,
} from '../../common/index.js';
import { Entry, EntryId, EntryListQuery, EntryMonthPage, InstallmentPage, NewEntry } from './entries.dto.js';
import { EntriesService } from './entries.service.js';

/** O parâmetro do id do lançamento, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id do lançamento.' } as const;

const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: o lançamento não existe.' };
const VIEW_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description: '`FORBIDDEN`: o usuário não tem `view` nem `operate` na entidade dona do lançamento (regra 6.1).',
};

// As rotas de um lançamento exigem a permissão na entidade dona: `view` para ler e `operate` para
// registrar (regra 6.1), conferidas pelo serviço. Só a lista do mês é uma rota de dados, com o
// Financial-Context.
@ApiTags('entries')
@ApiBearerAuth('session')
@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Get()
  @RequiresFinancialContext('view')
  @ApiOperation({ summary: 'Lista as parcelas do mês dos lançamentos do contexto financeiro.' })
  @ApiOkResponse({
    type: EntryMonthPage,
    description:
      'A página das parcelas que vencem no mês, cada uma com o lançamento dela, das pessoas físicas do contexto financeiro, com o total (LLD, seção 5): pelo vencimento, da mais recente para a mais antiga e, no mesmo dia, pela ordem do registro, a última primeiro. As empresas do contexto ficam de fora, porque os lançamentos delas entram com a clínica.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o cabeçalho `Financial-Context` falta ou não é `entity:<id>` nem `group:<id>` com um UUID, o mês falta ou não é `AAAA-MM`, o tipo não é `revenue` nem `expense`, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description:
      '`FORBIDDEN`: o usuário não tem `view` nem `operate` numa entidade do contexto, ou o id do contexto não é de nenhuma entidade nem de nenhum grupo (regra 6.2).',
  })
  @ApiHeader({
    name: FINANCIAL_CONTEXT_HEADER,
    required: true,
    description: 'O contexto financeiro escolhido (LLD, seção 5): `entity:<id>` ou `group:<id>`, com o id em UUID.',
    schema: { type: 'string', example: 'group:0190d3f2-6c1e-7a4b-9f00-1a2b3c4d5e6f' },
  })
  list(@Query() query: EntryListQuery): Promise<EntryMonthPage> {
    const month = parseCalendarMonth(query.month);
    if (!month) throw new Error('O mês chegou ao controlador sem passar pela validação.');
    return this.entries.list({
      entities: currentFinancialContext().entities,
      month,
      type: query.type,
      q: query.q,
      page: pageRequest(query),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Registra uma receita ou uma despesa de uma pessoa física, à vista ou parcelada.' })
  @ApiCreatedResponse({
    type: Entry,
    description:
      'O lançamento foi criado, na versão 1, com as parcelas mensais a partir do primeiro vencimento: o total dividido em centavos, com a diferença na primeira (regra 6.21).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a entidade, a categoria ou a conta faltam ou não são UUIDs, o tipo falta ou não é `revenue` nem `expense`, a descrição falta, é vazia ou passa de 200 caracteres, a finalidade falta na despesa, vem na receita ou não é `personal` nem `household`, a data do fato ou o primeiro vencimento não são `AAAA-MM-DD`, o total não é uma string decimal maior que zero com até 2 casas, ou o número de parcelas não é um inteiro de 1 a 120, ou passa do total em centavos (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `operate` na entidade, ou ela não existe (regra 6.1).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`ENTITY_NOT_INDIVIDUAL`: a entidade é uma empresa, cujos lançamentos entram com a clínica. `INACTIVE_ENTITY`: a entidade está desativada (regra 6.2). `INVALID_CATEGORY`: a categoria não existe. `CATEGORY_NATURE_MISMATCH`: a categoria é de outra natureza que o tipo. `INACTIVE_CATEGORY`: a categoria está desativada (regra 6.20). `INVALID_ACCOUNT`: a conta não existe ou é de outra entidade. `INACTIVE_ACCOUNT`: a conta está desativada (regra 6.20).',
  })
  create(@Body() body: NewEntry): Promise<Entry> {
    return this.entries.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lê um lançamento.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Entry, description: 'O lançamento, sem as parcelas, que têm a lista delas.' })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(VIEW_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  get(@Param() params: EntryId): Promise<Entry> {
    return this.entries.get(params.id);
  }

  @Get(':id/installments')
  @ApiOperation({ summary: 'Lista as parcelas de um lançamento.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: InstallmentPage,
    description:
      'A página das parcelas do lançamento, pelo número, com a situação de cada uma (regra 6.6) e o total (LLD, seção 5).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(VIEW_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  installments(@Param() params: EntryId, @Query() query: PageQuery): Promise<InstallmentPage> {
    return this.entries.installments(params.id, pageRequest(query));
  }
}
