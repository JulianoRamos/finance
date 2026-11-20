import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
  RequiresFinancialContext,
  UNAUTHENTICATED_RESPONSE,
} from '../../common/index.js';
import {
  Account,
  AccountActivation,
  AccountEdit,
  AccountId,
  AccountListQuery,
  AccountPage,
  NewAccount,
} from './accounts.dto.js';
import { AuditHistoryPage } from '../audit/index.js';
import { AccountsService } from './accounts.service.js';

/** O parâmetro do id da conta, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id da conta.' } as const;

const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: a conta não existe.' };
const VIEW_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description: '`FORBIDDEN`: o usuário não tem `view` nem `operate` na entidade dona da conta (regra 6.1).',
};
const OPERATE_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description:
    '`FORBIDDEN`: o usuário não tem `operate` na entidade dona da conta (quem só tem `view` só lê) (regra 6.1).',
};
const VERSION_CONFLICT_RESPONSE = {
  type: ApiError,
  description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: a conta mudou desde a leitura (regra 6.20).',
};

// As rotas de uma conta exigem a permissão na entidade dona: `view` para ler e `operate` para alterar
// (regra 6.1), conferidas pelo serviço, porque o id da rota é o da conta. Só a lista é uma rota de
// dados, com o Financial-Context: a leitura, a edição e o histórico abrem uma conta de qualquer
// contexto em que o usuário tem permissão, como a pesquisa a oferece.
@ApiTags('accounts')
@ApiBearerAuth('session')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @RequiresFinancialContext('view')
  @ApiOperation({ summary: 'Lista as contas do contexto financeiro.' })
  @ApiOkResponse({
    type: AccountPage,
    description:
      'A página das contas das entidades do contexto financeiro, com o total (LLD, seção 5): as ativas primeiro e cada grupo pelo nome, em ordem alfabética.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o cabeçalho `Financial-Context` falta ou não é `entity:<id>` nem `group:<id>` com um UUID, a `page` não é um inteiro a partir de 1, o `pageSize` não é um inteiro de 1 a 100, ou o `active` não é `true` nem `false` (em `fields`).',
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
  list(@Query() query: AccountListQuery): Promise<AccountPage> {
    return this.accounts.list({
      entityIds: currentFinancialContext().entities.map((entity) => entity.id),
      active: query.active === undefined ? undefined : query.active === 'true',
      q: query.q,
      page: pageRequest(query),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma conta numa entidade.' })
  @ApiCreatedResponse({ type: Account, description: 'A conta foi criada, ativa, na versão 1.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a entidade falta ou não é um UUID, o nome falta, é vazio ou passa de 120 caracteres, o tipo ou o banco faltam ou não são conhecidos, o saldo inicial não é uma string decimal com até 2 casas, ou a data dele não é `AAAA-MM-DD` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `operate` na entidade, ou ela não existe (regra 6.1).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: '`INACTIVE_ENTITY`: a entidade está desativada, e não recebe conta nova (regra 6.2).',
  })
  create(@Body() body: NewAccount): Promise<Account> {
    return this.accounts.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lê uma conta.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Account, description: 'A conta, ativa ou desativada.' })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(VIEW_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  get(@Param() params: AccountId): Promise<Account> {
    return this.accounts.get(params.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita os dados de uma conta.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Account, description: 'A conta editada, na versão seguinte.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a versão falta, a entidade falta ou não é um UUID, o nome falta, é vazio ou passa de 120 caracteres, o tipo ou o banco faltam ou não são conhecidos, o saldo inicial não é uma string decimal com até 2 casas, ou a data dele não é `AAAA-MM-DD` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`ACCOUNT_OWNER_IMMUTABLE`: a entidade enviada não é a dona atual: a dona da conta não muda depois do cadastro (LLD, seção 4.5).',
  })
  update(@Param() params: AccountId, @Body() body: AccountEdit): Promise<Account> {
    return this.accounts.update(params.id, body);
  }

  @Put(':id/active')
  @ApiOperation({ summary: 'Desativa ou reativa uma conta.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: Account,
    description:
      'A conta desativada ou reativada, com a versão seguinte. Pedir o estado que ela já tem responde 200 sem mudar a versão. Desativar não apaga nada (regra 6.20).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o id não é um UUID, ou o `active` ou a versão faltam (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  setActive(@Param() params: AccountId, @Body() body: AccountActivation): Promise<Account> {
    return this.accounts.setActive(params.id, body.active, body.version);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Lista o histórico de alterações de uma conta.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: AuditHistoryPage,
    description:
      'A página das alterações da conta, da auditoria, com o total (LLD, seção 5), da mais recente para a mais antiga (LLD, seção 4.4).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(VIEW_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  history(@Param() params: AccountId, @Query() query: PageQuery): Promise<AuditHistoryPage> {
    return this.accounts.history(params.id, pageRequest(query));
  }
}
