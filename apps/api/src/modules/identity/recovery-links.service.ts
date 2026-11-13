import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { apiError, type Clock, CLOCK, currentRequestContext, TransactionService } from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import type { RecoveryLink, SessionToken } from './identity.dto.js';
import { type Attempt, LoginAttemptsService } from './login-attempts.service.js';
import { hashPassword } from './passwords.js';
import { type Client, SessionsService } from './sessions.service.js';
import { hashToken, newToken } from './tokens.js';
import { UsersService } from './users.service.js';

/** Quanto o link de recuperação vale (regra 6.1). */
const RECOVERY_LINK_VALIDITY_MS = 60 * 60 * 1000;

/**
 * A recusa do link que não vale, a mesma para o que não existe, venceu ou foi usado. A tentativa, já
 * gravada como falha, conta para a origem.
 */
function notFound() {
  return apiError(
    HttpStatus.NOT_FOUND,
    'NOT_FOUND',
    'Este link venceu ou já foi usado. Peça um novo a quem gere os acessos.',
  );
}

/** Os links de recuperação do acesso (regra 6.1). */
@Injectable()
export class RecoveryLinksService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly attempts: LoginAttemptsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Cria um link de recuperação do usuário, na transação do comando, e devolve o token dele. */
  create(userId: string): Promise<string> {
    return this.transactions.run(async () => {
      const token = newToken();
      const now = this.clock.now();
      const link = await this.transactions.client.recoveryLink.create({
        data: {
          userId,
          tokenHash: hashToken(token),
          createdById: currentRequestContext()?.userId ?? null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + RECOVERY_LINK_VALIDITY_MS),
        },
      });
      await this.audit.record({
        action: 'create',
        tableName: 'recovery_link',
        recordId: link.id,
        entityId: null,
        before: null,
        after: link,
      });
      return token;
    });
  }

  /** O link do token, quando ele vale. A consulta de um link que não vale conta uma falha da origem. */
  async find(token: string, origin: string): Promise<RecoveryLink> {
    const attemptId = await this.attempts.begin(this.attemptFrom(origin));
    const link = await this.validLink(token);
    if (!link) throw notFound();
    await this.attempts.succeed(attemptId);
    return { email: link.user.email };
  }

  /**
   * Usa o link: define a senha do usuário, encerra as sessões dele e abre uma nova. O uso de um link
   * que não vale conta uma falha da origem.
   */
  async use(token: string, password: string, client: Client): Promise<SessionToken> {
    const attemptId = await this.attempts.begin(this.attemptFrom(client.origin));
    // O link é conferido antes do hash, que é caro; a transação confere de novo, para o uso concorrente.
    if (!(await this.validLink(token))) throw notFound();
    const passwordHash = await hashPassword(password);
    const opened = await this.transactions.run(async () => {
      const link = await this.validLink(token);
      if (!link) return null;
      const now = this.clock.now();
      // Só marca o link que ninguém usou ainda: dois usos ao mesmo tempo não passam os dois.
      const marked = await this.transactions.client.recoveryLink.updateMany({
        where: { id: link.id, usedAt: null },
        data: { usedAt: now },
      });
      if (marked.count === 0) return null;
      const { user, ...linkBefore } = link;
      await this.audit.record({
        action: 'update',
        tableName: 'recovery_link',
        recordId: link.id,
        entityId: null,
        before: linkBefore,
        after: { ...linkBefore, usedAt: now },
      });
      await this.users.setPassword(user, passwordHash);
      await this.sessions.endAll(user.id);
      return this.sessions.open(user.id, client);
    });
    if (!opened) throw notFound();
    await this.attempts.succeed(attemptId);
    return opened;
  }

  /** O link do token, com o usuário, quando ele não foi usado, não venceu e o usuário está ativo. */
  private async validLink(token: string) {
    const link = await this.transactions.client.recoveryLink.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    const now = this.clock.now();
    if (!link?.user.active || link.usedAt !== null || now > link.expiresAt) return null;
    return link;
  }

  /** A tentativa com um link, que não chega a um e-mail (regra 6.1). */
  private attemptFrom(origin: string): Attempt {
    return { email: null, origin, step: 'recovery' };
  }
}
