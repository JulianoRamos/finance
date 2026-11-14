import { SetMetadata } from '@nestjs/common';

import { ApiError } from '../../common/index.js';

/** A chave da marca das rotas de quem gere acessos, nos metadados do Nest. */
export const MANAGES_ACCESS = 'managesAccess';

/**
 * Marca a rota que só quem gere acessos usa: sem o `manages_access`, ela responde 403 `FORBIDDEN`
 * (regra 6.1). O guard da sessão lê a marca.
 */
export const ManagesAccess = (): MethodDecorator => SetMetadata(MANAGES_ACCESS, true);

/** A recusa da rota marcada, para quem não gere acessos. */
export const MANAGES_ACCESS_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description: '`FORBIDDEN`: o usuário da sessão não gere acessos (regra 6.1).',
};
