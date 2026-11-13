import { Inject, Injectable } from '@nestjs/common';

import { type Clock, CLOCK, isUniqueViolation, TransactionService } from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import { isEmail, normalizeEmail } from './email.js';
import { IdentityError } from './identity-error.js';

/** Um usuário novo. */
export interface NewUser {
  readonly name: string;
  readonly email: string;
  /** Se ele gere usuários e acessos (regra 6.1). */
  readonly managesAccess: boolean;
}

/** O dono da tabela `user`: toda leitura por e-mail e toda alteração, com a auditoria dela. */
@Injectable()
export class UsersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** O usuário do e-mail, comparado sem distinguir maiúsculas, ou nulo. */
  findByEmail(email: string) {
    return this.transactions.client.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  /** Cria o usuário, sem senha. Recusa um nome vazio, um e-mail inválido e um e-mail que já é de outro. */
  create(user: NewUser) {
    const name = user.name.trim();
    const email = normalizeEmail(user.email);
    if (!name) throw new IdentityError('Informe o nome do usuário.');
    if (!isEmail(email)) throw new IdentityError(`O e-mail ${email} não é válido.`);
    return this.transactions.run(async () => {
      const duplicate = () => new IdentityError(`Já existe um usuário com o e-mail ${email}.`);
      if (await this.findByEmail(email)) throw duplicate();
      const now = this.clock.now();
      const created = await this.transactions.client.user
        .create({ data: { name, email, managesAccess: user.managesAccess, createdAt: now, updatedAt: now } })
        .catch((error: unknown) => {
          // Outro pedido criou o mesmo e-mail entre a consulta e a criação.
          throw isUniqueViolation(error) ? duplicate() : error;
        });
      await this.audit.record({
        action: 'create',
        tableName: 'user',
        recordId: created.id,
        entityId: null,
        before: null,
        after: created,
      });
      return created;
    });
  }

  /** Grava o hash da senha nova do usuário, lido antes como `before`. */
  setPassword(before: { readonly id: string } & Record<string, unknown>, passwordHash: string): Promise<void> {
    return this.transactions.run(async () => {
      const after = await this.transactions.client.user.update({
        where: { id: before.id },
        data: { passwordHash, updatedAt: this.clock.now(), version: { increment: 1 } },
      });
      await this.audit.record({
        action: 'update',
        tableName: 'user',
        recordId: before.id,
        entityId: null,
        before,
        after,
      });
    });
  }
}
