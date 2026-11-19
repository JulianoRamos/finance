import { ApiProperty } from '@nestjs/swagger';

import { AuditAction, PageInfo } from '../../common/index.js';
import type { ChangeValue } from './changes.js';

/** Os tipos que um valor do histórico pode ter, em JSON. */
const CHANGE_VALUE_TYPES = [{ type: 'string' }, { type: 'boolean' }, { type: 'number' }];

export class AuditActor {
  @ApiProperty({ format: 'uuid', description: 'O id do usuário.' })
  id!: string;

  @ApiProperty({ description: 'O nome do usuário hoje, ativo ou desativado.', example: 'Ana Lima' })
  name!: string;
}

export class AuditChange {
  @ApiProperty({
    description: 'O campo que mudou, com o nome do modelo (camelCase), como `name` ou `taxId`.',
    example: 'name',
  })
  field!: string;

  @ApiProperty({
    nullable: true,
    description:
      'O valor de antes, em JSON (LLD, seção 4.4): texto, booleano, string decimal ou data `AAAA-MM-DD`. Nulo quando o campo estava vazio, e na criação.',
    oneOf: CHANGE_VALUE_TYPES,
    example: 'Clínica Ex.',
  })
  before!: ChangeValue;

  @ApiProperty({
    nullable: true,
    description: 'O valor de depois, no mesmo formato. Nulo quando o campo ficou vazio, e na exclusão.',
    oneOf: CHANGE_VALUE_TYPES,
    example: 'Clínica Exemplo',
  })
  after!: ChangeValue;
}

export class AuditHistoryEntry {
  @ApiProperty({ description: 'O id do registro de auditoria, um inteiro em texto.', example: '1024' })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Quando a alteração aconteceu, o instante da transação.',
  })
  occurredAt!: Date;

  @ApiProperty({
    type: AuditActor,
    nullable: true,
    description: 'Quem fez a alteração, ou nulo quando ela não veio de um usuário, como num comando no servidor.',
  })
  user!: AuditActor | null;

  @ApiProperty({
    enum: AuditAction,
    description: 'Criação (`create`), alteração (`update`) ou exclusão (`delete`).',
  })
  action!: AuditAction;

  @ApiProperty({
    description:
      'A tabela do registro alterado (LLD, seção 4.3): `entity` (a entidade), `entity_operation` (uma operação ligada) ou `equity_stake` (uma participação na empresa).',
    example: 'entity',
  })
  tableName!: string;

  @ApiProperty({ format: 'uuid', description: 'O id do registro alterado.' })
  recordId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'O nome da outra entidade de que a alteração fala: o sócio, numa participação. Nulo nas outras tabelas.',
    example: null,
  })
  subject!: string | null;

  @ApiProperty({
    type: AuditChange,
    isArray: true,
    description:
      'O que mudou, campo a campo, só nos campos que o usuário vê, sem o id, os instantes de criação e de alteração e a versão. Na criação, os campos preenchidos, com o antes nulo; na alteração, os que mudaram; na exclusão, os que havia, com o depois nulo.',
  })
  changes!: AuditChange[];
}

export class AuditHistoryPage extends PageInfo {
  @ApiProperty({
    type: AuditHistoryEntry,
    isArray: true,
    description: 'As alterações da página, da mais recente para a mais antiga.',
  })
  items!: AuditHistoryEntry[];
}
