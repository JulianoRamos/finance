const DAY_MS = 24 * 60 * 60 * 1000;
/** O último uso é gravado no máximo uma vez por minuto (regra 6.1). */
const TOUCH_INTERVAL_MS = 60 * 1000;

/** Os instantes de uma sessão que decidem se ela vale. */
interface SessionTimes {
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
  readonly endedAt: Date | null;
}

/**
 * Se a sessão vale no instante dado (regra 6.1): não foi encerrada, não passou do prazo máximo e não
 * ficou mais que os dias de inatividade sem uso.
 */
export function isSessionValid(session: SessionTimes, now: Date, idleDays: number): boolean {
  return (
    session.endedAt === null &&
    now.getTime() <= session.expiresAt.getTime() &&
    now.getTime() - session.lastUsedAt.getTime() <= idleDays * DAY_MS
  );
}

/** O prazo máximo da sessão aberta no instante dado: o login mais os dias do prazo máximo (regra 6.1). */
export function sessionExpiresAt(openedAt: Date, maxDays: number): Date {
  return new Date(openedAt.getTime() + maxDays * DAY_MS);
}

/** Se o uso no instante dado grava o último uso, que muda no máximo uma vez por minuto. */
export function shouldRecordUse(lastUsedAt: Date, now: Date): boolean {
  return now.getTime() - lastUsedAt.getTime() >= TOUCH_INTERVAL_MS;
}
