import { HttpStatus, Injectable } from '@nestjs/common';

import { apiError, TransactionService } from '../../common/index.js';
import type { ChangePassword } from './identity.dto.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { type AuthenticatedSession, SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

/** A troca de senha do usuário da sessão corrente (regra 6.1). */
@Injectable()
export class PasswordChangeService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly attempts: LoginAttemptsService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Confere a senha atual, no limite de tentativas do login: a tentativa é gravada como falha do e-mail
   * do usuário, na etapa da senha, e da origem, antes da conferência. Com ela certa, grava a senha nova e
   * encerra as outras sessões do usuário, na mesma transação, mantendo a corrente.
   */
  async change(session: AuthenticatedSession, passwords: ChangePassword, origin: string): Promise<void> {
    // A busca do usuário não depende da tentativa, que é gravada antes da conferência da senha.
    const [attemptId, user] = await Promise.all([
      this.attempts.begin({ email: session.user.email, origin, step: 'password' }),
      this.users.findByEmail(session.user.email),
    ]);
    if (!user || !(await verifyPassword(user.passwordHash, passwords.currentPassword))) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_CURRENT_PASSWORD',
        'A senha atual não confere. Confira e tente de novo.',
      );
    }
    const [, passwordHash] = await Promise.all([this.attempts.succeed(attemptId), hashPassword(passwords.password)]);
    await this.transactions.run(async () => {
      await this.users.setPassword(user, passwordHash);
      await this.sessions.endOthers(user.id, session.id);
    });
  }
}
