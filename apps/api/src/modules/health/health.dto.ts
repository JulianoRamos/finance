import { ApiProperty } from '@nestjs/swagger';

const DATABASE_STATES = ['connected', 'down'] as const;

/** O estado da conexão com o banco. */
export type DatabaseState = (typeof DATABASE_STATES)[number];

export class Health {
  @ApiProperty({
    enum: DATABASE_STATES,
    enumName: 'DatabaseState',
    description: 'Se o banco respondeu a uma consulta dentro do prazo.',
  })
  database!: DatabaseState;
}
