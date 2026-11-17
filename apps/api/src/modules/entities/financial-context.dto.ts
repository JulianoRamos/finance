import { ApiProperty } from '@nestjs/swagger';

import { EntityType } from '../../common/index.js';

export class FinancialContextEntity {
  @ApiProperty({ format: 'uuid', description: 'O id da entidade.' })
  id!: string;

  @ApiProperty({ enum: EntityType, description: 'Pessoa física (`individual`) ou jurídica (`company`).' })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Ana Lima' })
  name!: string;

  @ApiProperty({
    description: 'Falso na entidade desativada: ela continua no contexto, pelos números do passado (regra 6.2).',
  })
  active!: boolean;
}

export class FinancialContext {
  @ApiProperty({
    enum: ['entity', 'group'],
    description: 'Uma entidade (`entity`) ou um grupo financeiro (`group`).',
  })
  kind!: 'entity' | 'group';

  @ApiProperty({ format: 'uuid', description: 'O id da entidade ou do grupo.' })
  id!: string;

  @ApiProperty({ description: 'O nome da entidade ou do grupo.', example: 'Visão Familiar' })
  name!: string;

  @ApiProperty({ description: 'Verdadeiro só na Visão Familiar.' })
  isFamilyView!: boolean;

  @ApiProperty({
    type: FinancialContextEntity,
    isArray: true,
    description:
      'As entidades que o contexto reúne, pelo nome: a própria entidade, ou os membros do grupo. Vazia num grupo sem membros.',
  })
  entities!: FinancialContextEntity[];
}
