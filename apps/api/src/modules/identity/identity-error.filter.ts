import { type ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { apiError } from '../../common/index.js';
import { IdentityError } from './identity-error.js';

/**
 * A recusa da Identidade que chega a uma rota: a que tem o código do contrato responde 422 com ele
 * (LLD, seção 5); a sem código, que é só dos comandos no servidor, segue como erro interno.
 */
@Catch(IdentityError)
export class IdentityErrorFilter extends BaseExceptionFilter {
  override catch(error: IdentityError, host: ArgumentsHost): void {
    super.catch(error.code ? apiError(HttpStatus.UNPROCESSABLE_ENTITY, error.code, error.message) : error, host);
  }
}
