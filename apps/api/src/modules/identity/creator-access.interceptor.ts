import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, type Observable } from 'rxjs';

import { currentRequestContext, GRANTS_CREATOR_ACCESS, TransactionService } from '../../common/index.js';
import { PermissionsService } from './permissions.service.js';

/**
 * Dá `operate` a quem cadastra uma entidade, na rota marcada com `@GrantsCreatorAccess()` (regra 6.1):
 * abre a transação, a rota cria a entidade dentro dela, e a permissão é gravada na entidade devolvida.
 * As duas ficam gravadas juntas, ou nenhuma fica.
 */
@Injectable()
export class CreatorAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly transactions: TransactionService,
    private readonly permissions: PermissionsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.reflector.get<boolean | undefined>(GRANTS_CREATOR_ACCESS, context.getHandler())) return next.handle();
    const userId = currentRequestContext()?.userId;
    if (!userId) throw new Error('A rota que dá a permissão ao criador pede a sessão.');
    return from(
      this.transactions.run(async () => {
        const created = (await lastValueFrom(next.handle())) as { readonly id: string };
        await this.permissions.grantCreator(userId, created.id);
        return created;
      }),
    );
  }
}
