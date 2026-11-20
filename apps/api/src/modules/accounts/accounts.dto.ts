import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import {
  AccountType,
  type DecimalRange,
  Institution,
  IsCalendarDate,
  IsDecimalText,
  IsName,
  NAME_MAX_LENGTH,
  PageInfo,
  PageQuery,
  SearchQuery,
  VersionRead,
} from '../../common/index.js';

/**
 * O saldo inicial: um `numeric(15,2)`, com o sinal, porque é um saldo, e não um valor de fluxo (LLD,
 * seção 4.5).
 */
const OPENING_BALANCE_RANGE: DecimalRange = { above: '-10000000000000', atMost: '9999999999999.99', scale: 2 };

const TYPE_DESCRIPTION =
  'Conta corrente (`checking`), conta de pagamento (`payment`) ou dinheiro em espécie (`cash`). O cartão de crédito entra com os cartões.';
const INSTITUTION_DESCRIPTION =
  'O banco, que escolhe o leitor dos extratos importados (regra 6.4). `other` para um banco que a importação não lê e para o dinheiro em espécie.';
const RESERVE_DESCRIPTION =
  'A conta de reserva: transferir para ela conta como aplicação, e tirar dela, como resgate (GLOSSARY.md).';
const OPENING_BALANCE_DESCRIPTION =
  'O saldo no começo do dia do saldo inicial, antes das movimentações dele, em string decimal com até 2 casas. Pode ser negativo, como o de uma conta no limite (LLD, seção 4.5).';
const OPENING_BALANCE_DATE_DESCRIPTION =
  'O dia do saldo inicial, `AAAA-MM-DD`: o saldo da conta soma as movimentações a partir dele, inclusive (regra 6.3).';
const OPENING_BALANCE_EXAMPLE = '2000.00';
const OPENING_BALANCE_DATE_EXAMPLE = '2026-09-01';

/** O id da entidade dona na entrada, com a descrição da rota. */
function OwnerInput(description: string): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ format: 'uuid', description }),
    IsUUID('all', { message: 'Escolha a entidade dona da conta.' }),
  );
}

// Os campos da conta que o cadastro e a edição mandam, depois da entidade dona.

function NameInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: 'O nome, como o usuário quer vê-lo. A api tira os espaços das pontas. Não é único.',
      minLength: 1,
      maxLength: NAME_MAX_LENGTH,
      example: 'Nubank',
    }),
    IsName({ message: `Informe o nome, com até ${String(NAME_MAX_LENGTH)} caracteres.` }),
  );
}

function TypeInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ enum: AccountType, description: TYPE_DESCRIPTION }),
    IsEnum(AccountType, { message: 'Escolha o tipo: conta corrente, conta de pagamento ou dinheiro.' }),
  );
}

function InstitutionInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ enum: Institution, description: INSTITUTION_DESCRIPTION }),
    IsEnum(Institution, { message: 'Escolha o banco.' }),
  );
}

function ReserveInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ description: RESERVE_DESCRIPTION }),
    IsBoolean({ message: 'Informe se é uma conta de reserva.' }),
  );
}

function OpeningBalanceInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ description: OPENING_BALANCE_DESCRIPTION, example: OPENING_BALANCE_EXAMPLE }),
    IsDecimalText(OPENING_BALANCE_RANGE, { message: 'Informe o saldo inicial, com até 2 casas depois da vírgula.' }),
  );
}

function OpeningBalanceDateInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      type: String,
      format: 'date',
      description: OPENING_BALANCE_DATE_DESCRIPTION,
      example: OPENING_BALANCE_DATE_EXAMPLE,
    }),
    IsCalendarDate({ message: 'Informe a data do saldo inicial.' }),
  );
}

export class Account {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'A entidade dona, que não muda depois do cadastro.' })
  entityId!: string;

  @ApiProperty({ description: 'O nome atual da entidade dona, que a lista e o detalhe mostram.', example: 'Ana Lima' })
  entityName!: string;

  @ApiProperty({ description: 'O nome da conta.', example: 'Nubank' })
  name!: string;

  @ApiProperty({ enum: AccountType, description: TYPE_DESCRIPTION })
  type!: AccountType;

  @ApiProperty({ enum: Institution, description: INSTITUTION_DESCRIPTION })
  institution!: Institution;

  @ApiProperty({ description: RESERVE_DESCRIPTION })
  isReserve!: boolean;

  @ApiProperty({ description: OPENING_BALANCE_DESCRIPTION, example: OPENING_BALANCE_EXAMPLE })
  openingBalance!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description: OPENING_BALANCE_DATE_DESCRIPTION,
    example: OPENING_BALANCE_DATE_EXAMPLE,
  })
  openingBalanceDate!: string;

  @ApiProperty({
    description: 'Falso na conta desativada, que some das escolhas de conta e continua nos números (regra 6.20).',
  })
  active!: boolean;

  @ApiProperty({
    type: 'integer',
    description: 'A versão, que a edição e a desativação mandam de volta (regra 6.20).',
    example: 1,
  })
  version!: number;
}

export class AccountPage extends PageInfo {
  @ApiProperty({ type: Account, isArray: true, description: 'As contas da página, na ordem da lista.' })
  items!: Account[];
}

export class NewAccount {
  @OwnerInput('A entidade dona, em que o usuário tem `operate`.')
  entityId!: string;

  @NameInput()
  name!: string;

  @TypeInput()
  type!: AccountType;

  @InstitutionInput()
  institution!: Institution;

  @ReserveInput()
  isReserve!: boolean;

  @OpeningBalanceInput()
  openingBalance!: string;

  @OpeningBalanceDateInput()
  openingBalanceDate!: string;
}

export class AccountEdit {
  @VersionRead()
  version!: number;

  @OwnerInput(
    'A entidade dona, que tem de ser a atual: a api recusa a troca com 422 `ACCOUNT_OWNER_IMMUTABLE` (LLD, seção 4.5).',
  )
  entityId!: string;

  @NameInput()
  name!: string;

  @TypeInput()
  type!: AccountType;

  @InstitutionInput()
  institution!: Institution;

  @ReserveInput()
  isReserve!: boolean;

  @OpeningBalanceInput()
  openingBalance!: string;

  @OpeningBalanceDateInput()
  openingBalanceDate!: string;
}

export class AccountActivation {
  @VersionRead()
  version!: number;

  @ApiProperty({ description: 'Falso desativa a conta; verdadeiro a reativa.' })
  @IsBoolean({ message: 'Informe se a conta fica ativa.' })
  active!: boolean;
}

export class AccountId {
  @ApiProperty({ format: 'uuid', description: 'O id da conta.' })
  @IsUUID('all', { message: 'O id da conta não é válido.' })
  id!: string;
}

export class AccountListQuery extends PageQuery {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      '`true` traz só as contas ativas, as que aparecem nas escolhas de conta; `false`, só as desativadas. Sem o parâmetro, traz todas.',
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'Use true ou false.' })
  active?: 'true' | 'false';

  @SearchQuery(
    'A busca: o texto procurado no nome da conta, sem diferença de acento nem de maiúsculas, em qualquer posição. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}
