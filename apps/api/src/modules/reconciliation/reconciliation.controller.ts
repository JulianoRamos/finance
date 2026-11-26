import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiError, pageRequest, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { Entry } from '../entries/index.js';
import {
  InstallmentPayment,
  InstallmentPaymentId,
  InstallmentPaymentListQuery,
  InstallmentPaymentPage,
  NewInstallmentPayment,
  NewPaidEntry,
} from './reconciliation.dto.js';
import { ReconciliationService } from './reconciliation.service.js';

const PAYMENT_ACCOUNT_REFUSALS =
  '`INVALID_ACCOUNT`: a conta do pagamento não existe ou é de outra entidade. `INACTIVE_ACCOUNT`: a conta do pagamento está desativada (regra 6.20). `INACTIVE_ENTITY`: a entidade dona está desativada (regra 6.2).';

// O pagamento das parcelas é do módulo Conciliação (regra 6.5): ele chama o Lançamentos e as Contas, e a
// permissão é a da entidade dona do lançamento, conferida pelo serviço.
@ApiTags('reconciliation')
@ApiBearerAuth('session')
@Controller()
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post('paid-entries')
  @ApiOperation({ summary: 'Registra uma receita ou uma despesa de uma pessoa física já paga.' })
  @ApiCreatedResponse({
    type: Entry,
    description:
      'O lançamento foi criado, como em `POST /v1/entries`, e, na mesma transação, a primeira parcela foi paga: a movimentação manual pelo valor dela na conta e na data do pagamento, e a conciliação entre as duas. À vista, a parcela única fica liquidada; no parcelado, só a primeira, e as outras são pagas depois, uma a uma (regra 6.5).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a entrada de `POST /v1/entries` não passa na validação dela, a conta do pagamento falta ou não é um UUID, ou a data do pagamento não é `AAAA-MM-DD` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `operate` na entidade, ou ela não existe (regra 6.1).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      'As recusas de `POST /v1/entries` (`ENTITY_NOT_INDIVIDUAL`, `INACTIVE_ENTITY`, `INVALID_CATEGORY`, `CATEGORY_NATURE_MISMATCH`, `INACTIVE_CATEGORY`, `INVALID_ACCOUNT` e `INACTIVE_ACCOUNT`, da conta das parcelas) e as da conta do pagamento: `INVALID_PAYMENT_ACCOUNT`, que não existe ou é de outra entidade, e `INACTIVE_PAYMENT_ACCOUNT`, que está desativada (regra 6.20).',
  })
  createPaidEntry(@Body() body: NewPaidEntry): Promise<Entry> {
    return this.reconciliation.createPaidEntry(body);
  }

  @Get('installment-payments')
  @ApiOperation({ summary: 'Lista os pagamentos das parcelas de um lançamento.' })
  @ApiOkResponse({
    type: InstallmentPaymentPage,
    description:
      'A página dos pagamentos das parcelas do lançamento, pelo número da parcela, com o total (LLD, seção 5). Cada parcela liquidada tem o dela.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o lançamento falta ou não é um UUID, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `view` nem `operate` na entidade dona do lançamento (regra 6.1).',
  })
  @ApiNotFoundResponse({ type: ApiError, description: '`NOT_FOUND`: o lançamento não existe.' })
  listPayments(@Query() query: InstallmentPaymentListQuery): Promise<InstallmentPaymentPage> {
    return this.reconciliation.listPayments(query.entryId, pageRequest(query));
  }

  @Post('installment-payments')
  @ApiOperation({ summary: 'Paga uma parcela em aberto.' })
  @ApiCreatedResponse({
    type: InstallmentPayment,
    description:
      'A parcela foi paga: a movimentação manual pelo valor em aberto dela, no sentido dela, na conta e na data dadas, e a conciliação entre as duas, numa transação. A parcela fica liquidada (regras 6.5 e 6.6).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a parcela ou a conta faltam ou não são UUIDs, ou a data não é `AAAA-MM-DD` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `operate` na entidade dona do lançamento da parcela (regra 6.1).',
  })
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description: `\`INVALID_INSTALLMENT\`: a parcela não existe. \`INSTALLMENT_ALREADY_SETTLED\`: a parcela já está liquidada; para pagá-la de novo, desfaça antes o pagamento. ${PAYMENT_ACCOUNT_REFUSALS}`,
  })
  payInstallment(@Body() body: NewInstallmentPayment): Promise<InstallmentPayment> {
    return this.reconciliation.payInstallment(body);
  }

  @Delete('installment-payments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desfaz o pagamento de uma parcela.' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'O id do pagamento.' })
  @ApiNoContentResponse({
    description:
      'O pagamento foi desfeito: a conciliação e a movimentação manual que o pagamento criou foram excluídas, e a parcela volta à situação calculada, prevista ou vencida, com o saldo da conta de antes (regras 6.5 e 6.6).',
  })
  @ApiBadRequestResponse({ type: ApiError, description: '`INVALID_INPUT`: o id não é um UUID (em `fields`).' })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description: '`FORBIDDEN`: o usuário não tem `operate` na entidade dona do lançamento da parcela (regra 6.1).',
  })
  @ApiNotFoundResponse({ type: ApiError, description: '`NOT_FOUND`: o pagamento não existe.' })
  undoPayment(@Param() params: InstallmentPaymentId): Promise<void> {
    return this.reconciliation.undoPayment(params.id);
  }
}
