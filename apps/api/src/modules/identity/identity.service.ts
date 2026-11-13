import { Injectable } from '@nestjs/common';

import { TransactionService } from '../../common/index.js';
import { normalizeEmail } from './email.js';
import { IdentityError } from './identity-error.js';
import { RecoveryLinksService } from './recovery-links.service.js';
import { type NewUser, UsersService } from './users.service.js';

/** O serviço público da Identidade, que os comandos e os outros módulos chamam. */
@Injectable()
export class IdentityService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly users: UsersService,
    private readonly recoveryLinks: RecoveryLinksService,
  ) {}

  /** Cria o usuário, sem senha, e um link de recuperação para ele defini-la. Devolve o token do link. */
  createUser(user: NewUser): Promise<string> {
    return this.transactions.run(async () => this.recoveryLinks.create((await this.users.create(user)).id));
  }

  /** Cria um link de recuperação para o usuário do e-mail e devolve o token dele. */
  createRecoveryLink(email: string): Promise<string> {
    return this.transactions.run(async () => {
      const user = await this.users.findByEmail(email);
      if (!user) throw new IdentityError(`Não há usuário com o e-mail ${normalizeEmail(email)}.`);
      // O link de um usuário desativado nunca valeria (regra 6.1).
      if (!user.active) throw new IdentityError(`O usuário ${user.email} está desativado: reative-o antes.`);
      return this.recoveryLinks.create(user.id);
    });
  }
}
