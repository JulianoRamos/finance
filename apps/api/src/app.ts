import { HttpStatus, type INestApplication, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { apiError, requestContextMiddleware } from './common/index.js';

/** O prefixo de todas as rotas (LLD, seção 5). */
export const PREFIX = 'v1';

/** O motivo de cada campo recusado, com a primeira regra que ele não cumpriu. */
function fieldsOf(errors: readonly ValidationError[]): Record<string, string> {
  return Object.fromEntries(
    errors.map((error) => [error.property, Object.values(error.constraints ?? {})[0] ?? 'Valor inválido.']),
  );
}

/**
 * O que vale para a api em qualquer lugar onde ela é montada: no servidor, nos testes e no comando
 * que gera a especificação, para os três verem as mesmas rotas.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(PREFIX);
  // O contexto de cada requisição: o identificador, o usuário e a transação do comando (LLD, seção 3).
  app.use(requestContextMiddleware);
  // A entrada de cada rota é conferida pelos decorators do DTO, e a recusada responde com o corpo de
  // erro do contrato (LLD, seção 5).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory: (errors) =>
        apiError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Confira os campos informados.', fieldsOf(errors)),
    }),
  );
}
