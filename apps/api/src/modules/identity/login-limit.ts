const MINUTE_MS = 60 * 1000;

/** Quantas falhas, dentro de que janela, bloqueiam por quanto tempo (regra 6.1). */
export interface AttemptLimit {
  readonly failures: number;
  /** A janela em que as falhas contam, e também quanto dura o bloqueio. */
  readonly windowMs: number;
}

/** 5 falhas de um e-mail, numa etapa, em 15 minutos. */
export const EMAIL_LIMIT: AttemptLimit = { failures: 5, windowMs: 15 * MINUTE_MS };
/** 20 falhas de uma origem em 15 minutos. */
export const ORIGIN_LIMIT: AttemptLimit = { failures: 20, windowMs: 15 * MINUTE_MS };

/**
 * Desde quando as falhas anteriores a um instante podem bloqueá-lo: o bloqueio dura a janela a partir
 * da falha que atingiu o limite, e essa falha fecha um grupo que cabe numa janela.
 */
export function relevantSince(now: Date, limit: AttemptLimit): Date {
  return new Date(now.getTime() - 2 * limit.windowMs);
}

/**
 * Se as falhas bloqueiam no instante dado (regra 6.1): algum grupo de `limit.failures` falhas cabe
 * numa janela, e a última dele foi há menos de uma janela.
 */
export function isBlocked(failures: readonly Date[], now: Date, limit: AttemptLimit): boolean {
  const times = failures.map((failure) => failure.getTime()).sort((a, b) => a - b);
  for (let last = limit.failures - 1; last < times.length; last++) {
    const reachedAt = times[last] ?? 0;
    const firstOfGroup = times[last - limit.failures + 1] ?? 0;
    if (reachedAt - firstOfGroup < limit.windowMs && now.getTime() - reachedAt < limit.windowMs) return true;
  }
  return false;
}
