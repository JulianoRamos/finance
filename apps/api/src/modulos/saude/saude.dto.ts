import { ApiProperty } from '@nestjs/swagger';

const ESTADOS_BANCO = ['conectado', 'fora_do_ar'] as const;

/** O estado da conexão com o banco. */
export type EstadoBanco = (typeof ESTADOS_BANCO)[number];

export class Saude {
  @ApiProperty({
    enum: ESTADOS_BANCO,
    enumName: 'EstadoBanco',
    description: 'Se o banco respondeu a uma consulta dentro do prazo.',
  })
  banco!: EstadoBanco;
}
