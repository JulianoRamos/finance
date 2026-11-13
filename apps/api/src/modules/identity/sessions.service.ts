import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { apiError, type Clock, CLOCK, CONFIG, type Config, TransactionService } from '../../common/index.js';
import { normalizeEmail } from './email.js';
import type { SessionToken } from './identity.dto.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { verifyPassword } from './passwords.js';
import { isSessionValid, sessionExpiresAt, shouldRecordUse } from './session-rules.js';
import { hashToken, newToken } from './tokens.js';
import { UsersService } from './users.service.js';

/** A mensagem do login recusado, a mesma exista ou não o e-mail (LLD, seção 5). */
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos. Confira os dois e tente de novo.';

/** De onde veio o pedido que abre uma sessão. */
export interface Client {
  readonly origin: string;
  readonly userAgent: string | null;
}

/** Uma sessão reconhecida pelo token, com o usuário dela. */
export interface AuthenticatedSession {
  readonly id: string;
  readonly expiresAt: Date;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly managesAccess: boolean;
  };
}

/** As sessões de login (regra 6.1). */
@Injectable()
export class SessionsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly attempts: LoginAttemptsService,
    private readonly users: UsersService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Confere o e-mail e a senha e abre uma sessão. */
  async login(email: string, password: string, client: Client): Promise<SessionToken> {
    const attempt = { email: normalizeEmail(email), origin: client.origin, step: 'password' } as const;
    const attemptId = await this.attempts.begin(attempt);
    const user = await this.users.findByEmail(attempt.email);
    const matches = await verifyPassword(user?.passwordHash ?? null, password);
    if (!user?.active || !matches) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
    }
    await this.attempts.succeed(attemptId);
    return this.open(user.id, client);
  }

  /** Abre uma sessão do usuário, que vence no prazo máximo. */
  async open(userId: string, client: Client): Promise<SessionToken> {
    const token = newToken();
    const now = this.clock.now();
    const expiresAt = sessionExpiresAt(now, this.config.sessionMaxDays);
    await this.transactions.client.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
        origin: client.origin,
        userAgent: client.userAgent,
      },
    });
    return { token, expiresAt };
  }

  /** Encerra todas as sessões abertas do usuário. */
  async endAll(userId: string): Promise<void> {
    await this.transactions.client.session.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: this.clock.now() },
    });
  }

  /** A sessão do token, quando ela vale, ou nula. */
  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    const session = await this.transactions.client.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, name: true, email: true, managesAccess: true, active: true } } },
    });
    const now = this.clock.now();
    if (!session?.user.active || !isSessionValid(session, now, this.config.sessionIdleDays)) return null;
    if (shouldRecordUse(session.lastUsedAt, now)) {
      await this.transactions.client.session.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    }
    const { id, name, email, managesAccess } = session.user;
    return { id: session.id, expiresAt: session.expiresAt, user: { id, name, email, managesAccess } };
  }
}
