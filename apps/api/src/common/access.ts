import { SetMetadata } from '@nestjs/common';

import type { PermissionLevel } from './prisma-types.js';

// As marcas de rota da permissão por entidade (regra 6.1). Os módulos marcam as rotas; a Identidade
// lê as marcas e confere a permissão, sem que o módulo da rota a chame (LLD, seção 3).

/** A chave do nível que a rota exige na entidade do parâmetro `id`, nos metadados do Nest. */
export const REQUIRED_ENTITY_LEVEL = 'requiredEntityLevel';

/**
 * Marca a rota da entidade do parâmetro `id`: `view` para ler e `operate` para alterar. Sem o nível,
 * ou com um id que não existe, a rota responde 403 `FORBIDDEN` (regra 6.1).
 */
export const RequiresEntityLevel = (level: PermissionLevel): MethodDecorator =>
  SetMetadata(REQUIRED_ENTITY_LEVEL, level);

/** A chave da marca da rota que cadastra uma entidade, nos metadados do Nest. */
export const GRANTS_CREATOR_ACCESS = 'grantsCreatorAccess';

/**
 * Marca a rota que cadastra uma entidade e a devolve: quem a cadastra recebe `operate` nela, na mesma
 * transação (regra 6.1).
 */
export const GrantsCreatorAccess = (): MethodDecorator => SetMetadata(GRANTS_CREATOR_ACCESS, true);
