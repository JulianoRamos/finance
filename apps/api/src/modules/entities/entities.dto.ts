import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

import { EntityType, Operation } from '../../common/index.js';
import { invalidTaxIdMessage, isValidTaxId, normalizeTaxId } from './tax-id.js';

/** O limite de cima do nome da entidade, sem os espaços das pontas. */
const NAME_MAX_LENGTH = 120;

const TYPE_DESCRIPTION =
  'Pessoa física (`individual`) ou jurídica (`company`). Não muda depois da criação (regra 6.2).';
const NAME_DESCRIPTION = 'O nome, como o usuário quer vê-lo. A api tira os espaços das pontas.';
const TAX_ID_INPUT_DESCRIPTION =
  'O CPF (pessoa física) ou o CNPJ (pessoa jurídica, também o alfanumérico), com ou sem a pontuação. Opcional: nulo ou vazio fica sem documento. A api confere os dígitos verificadores e o guarda só com os caracteres, com as letras em maiúsculas. Único entre todas as entidades.';

/** O nome tem de 1 a 120 caracteres, sem contar os espaços das pontas. */
function IsEntityName(options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isEntityName',
      validator: {
        validate: (value) =>
          typeof value === 'string' && value.trim().length > 0 && value.trim().length <= NAME_MAX_LENGTH,
      },
    },
    options,
  );
}

/**
 * O documento é um CPF válido na pessoa física ou um CNPJ válido na jurídica, com ou sem a pontuação.
 * O vazio passa: fica sem documento. Sem um tipo conhecido, quem recusa é o campo do tipo.
 */
function IsTaxIdOfType(): PropertyDecorator {
  return ValidateBy({
    name: 'isTaxIdOfType',
    validator: {
      validate: (value, args) => {
        const type = (args?.object as { type?: unknown } | undefined)?.type;
        const taxId = typeof value === 'string' ? normalizeTaxId(value) : null;
        if (taxId === null || (type !== EntityType.individual && type !== EntityType.company)) return true;
        return isValidTaxId(type, taxId);
      },
      defaultMessage: (args) =>
        invalidTaxIdMessage(
          (args?.object as { type?: unknown } | undefined)?.type === EntityType.individual ? 'individual' : 'company',
        ),
    },
  });
}

/** A versão lida, que a edição e a desativação mandam de volta (regra 6.20). */
function VersionRead(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: 'integer', minimum: 1, description: 'A versão lida (regra 6.20).' }),
    IsInt({ message: 'Informe a versão lida.' }),
    Min(1, { message: 'Informe a versão lida.' }),
  );
}

/** O nome da entidade na entrada. */
function EntityName(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: NAME_DESCRIPTION,
      minLength: 1,
      maxLength: NAME_MAX_LENGTH,
      example: 'Clínica Exemplo',
    }),
    IsEntityName({ message: `Informe o nome, com até ${String(NAME_MAX_LENGTH)} caracteres.` }),
  );
}

/**
 * O documento opcional na entrada. Na criação, ele é conferido contra o tipo aqui; na edição, o
 * serviço o confere depois de recusar a mudança de tipo, para ela responder com o código dela.
 */
function TaxIdInput({ checkAgainstType }: { checkAgainstType: boolean }): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      type: String,
      nullable: true,
      description: TAX_ID_INPUT_DESCRIPTION,
      example: '00.000.000/0001-91',
    }),
    IsOptional(),
    IsString({ message: 'O documento precisa ser um texto.' }),
    ...(checkAgainstType ? [IsTaxIdOfType()] : []),
  );
}

export class Entity {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: EntityType, description: TYPE_DESCRIPTION })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Clínica Exemplo' })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'O CPF ou o CNPJ, só com os caracteres, sem a pontuação. Nulo quando a entidade não tem documento. A web o formata, e mascara o CPF nas listas.',
    example: '00000000000191',
  })
  taxId!: string | null;

  @ApiProperty({
    description: 'Falso na entidade desativada, que some das escolhas e continua nos registros (regra 6.2).',
  })
  active!: boolean;

  @ApiProperty({
    enum: Operation,
    isArray: true,
    description: 'As operações ligadas, em ordem alfabética. Sempre vazia na pessoa física (regra 6.2).',
    example: ['clinic'],
  })
  operations!: Operation[];

  @ApiProperty({
    type: 'integer',
    description: 'A versão, que a edição e a desativação mandam de volta (regra 6.20).',
    example: 1,
  })
  version!: number;
}

export class NewEntity {
  @ApiProperty({ enum: EntityType, description: TYPE_DESCRIPTION })
  @IsEnum(EntityType, { message: 'Escolha pessoa física ou pessoa jurídica.' })
  type!: EntityType;

  @EntityName()
  name!: string;

  @TaxIdInput({ checkAgainstType: true })
  taxId?: string | null;

  @ApiPropertyOptional({
    enum: Operation,
    isArray: true,
    uniqueItems: true,
    description: 'As operações a ligar na criação. Opcional, e só na pessoa jurídica (regra 6.2).',
  })
  @IsOptional()
  @IsArray({ message: 'Informe as operações numa lista.' })
  @IsEnum(Operation, { each: true, message: 'A operação não é conhecida.' })
  @ArrayUnique({ message: 'Uma operação aparece mais de uma vez.' })
  operations?: Operation[];
}

export class EntityListQuery {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      '`true` traz só as entidades ativas, as que aparecem nas escolhas; `false`, só as desativadas. Sem o parâmetro, traz todas.',
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'Use true ou false.' })
  active?: 'true' | 'false';
}

export class EntityId {
  @ApiProperty({ format: 'uuid', description: 'O id da entidade.' })
  @IsUUID('all', { message: 'O id da entidade não é válido.' })
  id!: string;
}

export class EntityOperationParams extends EntityId {
  @ApiProperty({ enum: Operation, description: 'A operação. Por enquanto, só a de clínica.' })
  @IsEnum(Operation, { message: 'A operação não é conhecida.' })
  operation!: Operation;
}

export class EntityActivation {
  @VersionRead()
  version!: number;

  @ApiProperty({ description: 'Falso desativa a entidade; verdadeiro a reativa.' })
  @IsBoolean({ message: 'Informe se a entidade fica ativa.' })
  active!: boolean;
}

export class EntityEdit {
  @VersionRead()
  version!: number;

  @ApiProperty({
    enum: EntityType,
    description:
      'O tipo da entidade, que tem de ser o atual: a api recusa a mudança com 422 `ENTITY_TYPE_IMMUTABLE` (regra 6.2).',
  })
  @IsEnum(EntityType, { message: 'Escolha pessoa física ou pessoa jurídica.' })
  type!: EntityType;

  @EntityName()
  name!: string;

  @TaxIdInput({ checkAgainstType: false })
  taxId?: string | null;
}
