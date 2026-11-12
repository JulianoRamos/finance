import type { INestApplication } from '@nestjs/common';

/** O prefixo de todas as rotas (LLD, seção 5). */
export const PREFIX = 'v1';

/**
 * O que vale para a api em qualquer lugar onde ela é montada: no servidor, nos testes e no comando
 * que gera a especificação, para os três verem as mesmas rotas.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(PREFIX);
}
