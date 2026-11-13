import { SetMetadata } from '@nestjs/common';

/** A chave da marca de rota pública nos metadados do Nest. */
export const PUBLIC_ROUTE = 'publicRoute';

/**
 * Marca a rota, ou o controlador inteiro, como pública: ela responde sem sessão (LLD, seção 5). As
 * outras são protegidas pela autenticação, que só lê esta marca.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE, true);
