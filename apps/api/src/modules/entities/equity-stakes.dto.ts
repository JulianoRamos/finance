import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import {
  type DecimalRange,
  EntityType,
  IsCalendarDate,
  IsDecimalText,
  IsNotBefore,
  PageInfo,
  VersionRead,
} from '../../common/index.js';

/** A fração de uma participação: de mais de 0 até 1, com até 8 casas, como o `numeric(9,8)` (LLD, seção 4.1). */
const FRACTION_RANGE: DecimalRange = { above: '0', atMost: '1', scale: 8 };

const DATE_EXAMPLE = '2026-11-01';
const INVALID_DATE = 'Informe uma data no formato AAAA-MM-DD.';
export const END_BEFORE_START = 'O último dia não pode vir antes do início.';

export class EquityStakeHolder {
  @ApiProperty({ format: 'uuid', description: 'O id da entidade.' })
  id!: string;

  @ApiProperty({ enum: EntityType, description: 'Pessoa física (`individual`) ou jurídica (`company`).' })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Ana Lima' })
  name!: string;

  @ApiProperty({
    description:
      'Falso no sócio desativado depois de registrada a participação, que continua no histórico (regra 6.2).',
  })
  active!: boolean;
}

export class EquityStake {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: EquityStakeHolder })
  holder!: EquityStakeHolder;

  @ApiProperty({
    description:
      'A fração da empresa que pertence ao sócio, como string decimal com 8 casas, de mais de 0 até 1 (LLD, seção 4.1).',
    example: '0.20000000',
  })
  fraction!: string;

  @ApiProperty({ type: String, format: 'date', description: 'O primeiro dia da participação.', example: DATE_EXAMPLE })
  startDate!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'O último dia da participação, ou nulo enquanto ela não foi encerrada. Depois dele, a fração deixa de contar como vigente (regra 6.2).',
    example: null,
  })
  endDate!: string | null;

  @ApiProperty({
    type: 'integer',
    description: 'A versão, que o encerramento manda de volta (regra 6.20).',
    example: 1,
  })
  version!: number;
}

export class EquityStakePage extends PageInfo {
  @ApiProperty({ type: EquityStake, isArray: true, description: 'As participações da página, na ordem da lista.' })
  items!: EquityStake[];
}

export class NewEquityStake {
  @ApiProperty({
    format: 'uuid',
    description: 'O id do sócio: uma pessoa física ou outra empresa, ativa, em que o usuário tem `view` ou `operate`.',
  })
  @IsUUID('all', { message: 'O id do sócio não é válido.' })
  holderId!: string;

  @ApiProperty({
    description: 'A fração da empresa, como string decimal, de mais de 0 até 1, com até 8 casas (LLD, seção 4.1).',
    example: '0.2',
  })
  @IsDecimalText(FRACTION_RANGE, { message: 'Informe uma fração de mais de 0 até 1, com até 8 casas.' })
  fraction!: string;

  @ApiProperty({ type: String, format: 'date', description: 'O primeiro dia da participação.', example: DATE_EXAMPLE })
  @IsCalendarDate({ message: INVALID_DATE })
  startDate!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    required: false,
    description:
      'O último dia, no mesmo dia do início ou depois dele. Opcional: nulo ou ausente deixa a participação sem fim.',
    example: null,
  })
  @IsOptional()
  @IsCalendarDate({ message: INVALID_DATE })
  @IsNotBefore('startDate', { message: END_BEFORE_START })
  endDate?: string | null;
}

export class EquityStakeEnd {
  @VersionRead()
  version!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'O último dia da participação, no mesmo dia do início ou depois dele.',
    example: DATE_EXAMPLE,
  })
  @IsCalendarDate({ message: INVALID_DATE })
  endDate!: string;
}

export class EquityStakeCompanyId {
  @ApiProperty({ format: 'uuid', description: 'O id da empresa.' })
  @IsUUID('all', { message: 'O id da empresa não é válido.' })
  id!: string;
}

export class EquityStakeParams extends EquityStakeCompanyId {
  @ApiProperty({ format: 'uuid', description: 'O id da participação.' })
  @IsUUID('all', { message: 'O id da participação não é válido.' })
  stakeId!: string;
}
