import { HttpException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** O corpo de erro de toda rota (LLD, seção 5). */
export class ApiError {
  @ApiProperty({
    description: 'O código estável do erro, em UPPER_SNAKE_CASE, que o cliente confere.',
    example: 'INVALID_INPUT',
  })
  code!: string;

  @ApiProperty({ description: 'O texto para o usuário, em português. Pode mudar.' })
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Na entrada inválida: o motivo de cada campo recusado.',
    additionalProperties: { type: 'string' },
  })
  fields?: Record<string, string>;
}

/** A exceção que a rota lança para responder com o status e o corpo de erro do contrato. */
export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): HttpException {
  const body: ApiError = { code, message, ...(fields && { fields }) };
  return new HttpException(body, status);
}
