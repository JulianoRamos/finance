import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { apiError, type Clock, CLOCK, type LoginStep, TransactionService } from '../../common/index.js';
import { type AttemptLimit, EMAIL_LIMIT, isBlocked, ORIGIN_LIMIT, relevantSince } from './login-limit.js';

/** Uma tentativa de autenticação: o e-mail (nulo quando ela não chega a um), a origem e a etapa. */
export interface Attempt {
  readonly email: string | null;
  readonly origin: string;
  readonly step: LoginStep;
}

/**
 * O limite de tentativas por e-mail e por origem (regra 6.1), contado no login_attempt. A tentativa é
 * gravada como falha antes de ser conferida, e cada uma só conta as gravadas antes dela: tentativas
 * simultâneas não passam juntas do limite.
 */
@Injectable()
export class LoginAttemptsService {
  constructor(
    private readonly transactions: TransactionService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Começa a tentativa: grava-a como falha e devolve o id dela. Recusa com 429, e apaga o registro,
   * quando as falhas anteriores bloqueiam o e-mail, naquela etapa, ou a origem. A resposta é a mesma
   * exista ou não o e-mail.
   */
  async begin(attempt: Attempt): Promise<string> {
    const now = this.clock.now();
    const db = this.transactions.client;
    const { id } = await db.loginAttempt.create({
      data: { ...attempt, succeeded: false, attemptedAt: now },
      select: { id: true },
    });
    const [emailBlocked, originBlocked] = await Promise.all([
      attempt.email !== null && this.isBlocked({ email: attempt.email, step: attempt.step }, EMAIL_LIMIT, id, now),
      this.isBlocked({ origin: attempt.origin }, ORIGIN_LIMIT, id, now),
    ]);
    if (emailBlocked || originBlocked) {
      // A tentativa feita durante o bloqueio não é conferida nem contada.
      await db.loginAttempt.delete({ where: { id } });
      throw apiError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ATTEMPTS',
        'Muitas tentativas seguidas. Espere 15 minutos e tente de novo.',
      );
    }
    return id;
  }

  /** Marca a tentativa começada como bem-sucedida. */
  async succeed(id: string): Promise<void> {
    await this.transactions.client.loginAttempt.update({ where: { id }, data: { succeeded: true } });
  }

  /**
   * Se as falhas que o filtro escolhe, gravadas antes da tentativa (o id é um uuidv7, em ordem de
   * criação) e que ainda podem bloquear, atingem o limite.
   */
  private async isBlocked(
    filter: { email: string; step: LoginStep } | { origin: string },
    limit: AttemptLimit,
    before: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await this.transactions.client.loginAttempt.findMany({
      where: {
        ...filter,
        id: { lt: before },
        succeeded: false,
        attemptedAt: { gt: relevantSince(now, limit), lte: now },
      },
      select: { attemptedAt: true },
    });
    return isBlocked(
      rows.map((row) => row.attemptedAt),
      now,
      limit,
    );
  }
}
