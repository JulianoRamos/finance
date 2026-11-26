import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { IsCalendarDate, PageInfo, PageQuery } from '../../common/index.js';
import { NewEntry } from '../entries/index.js';

const PAYMENT_DATE_DESCRIPTION =
  'O dia do pagamento, ou do recebimento, na receita, `AAAA-MM-DD`: o da movimentação manual na conta. Pode vir antes do saldo inicial da conta, e aí não entra no saldo (regra 6.3).';

export class NewPaidEntry extends NewEntry {
  @ApiProperty({
    format: 'uuid',
    description:
      'A conta ativa da entidade dona em que o pagamento foi feito, ou o recebimento entrou. Pode ser outra que a das parcelas.',
  })
  @IsUUID('all', { message: 'Escolha a conta do pagamento.' })
  paymentAccountId!: string;

  @ApiProperty({ type: String, format: 'date', description: PAYMENT_DATE_DESCRIPTION, example: '2026-11-24' })
  @IsCalendarDate({ message: 'Informe a data do pagamento.' })
  paymentDate!: string;
}

export class NewInstallmentPayment {
  @ApiProperty({ format: 'uuid', description: 'A parcela em aberto que o pagamento liquida.' })
  @IsUUID('all', { message: 'A parcela não é válida.' })
  installmentId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'A conta ativa da entidade dona do lançamento em que o pagamento foi feito, ou o recebimento entrou. Pode ser outra que a da parcela.',
  })
  @IsUUID('all', { message: 'Escolha a conta do pagamento.' })
  accountId!: string;

  @ApiProperty({ type: String, format: 'date', description: PAYMENT_DATE_DESCRIPTION, example: '2026-11-24' })
  @IsCalendarDate({ message: 'Informe a data do pagamento.' })
  date!: string;
}

export class InstallmentPayment {
  @ApiProperty({ format: 'uuid', description: 'O id do pagamento, a conciliação, que o desfazer usa.' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'A parcela que o pagamento liquida.' })
  installmentId!: string;

  @ApiProperty({ type: 'integer', description: 'O número da parcela, a partir de 1.', example: 3 })
  installmentNumber!: number;

  @ApiProperty({ format: 'uuid', description: 'A movimentação manual que o pagamento criou na conta.' })
  movementId!: string;

  @ApiProperty({ format: 'uuid', description: 'A conta do pagamento.' })
  accountId!: string;

  @ApiProperty({ description: 'O nome atual da conta do pagamento.', example: 'Nubank' })
  accountName!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'O dia do pagamento, `AAAA-MM-DD`.',
    example: '2026-11-24',
  })
  date!: string;

  @ApiProperty({
    description:
      'O valor pago, o valor em aberto da parcela no pagamento, em string decimal com 2 casas, sempre maior que zero: o sentido é o da parcela.',
    example: '450.00',
  })
  amount!: string;
}

export class InstallmentPaymentPage extends PageInfo {
  @ApiProperty({
    type: InstallmentPayment,
    isArray: true,
    description: 'Os pagamentos da página, pelo número da parcela.',
  })
  items!: InstallmentPayment[];
}

export class InstallmentPaymentListQuery extends PageQuery {
  @ApiProperty({ format: 'uuid', description: 'O lançamento: a lista traz os pagamentos das parcelas dele.' })
  @IsUUID('all', { message: 'O lançamento não é válido.' })
  entryId!: string;
}

export class InstallmentPaymentId {
  @ApiProperty({ format: 'uuid', description: 'O id do pagamento.' })
  @IsUUID('all', { message: 'O id do pagamento não é válido.' })
  id!: string;
}
