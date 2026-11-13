import { describe, expect, it } from 'vitest';

import { isSessionValid, shouldRecordUse } from './session-rules.js';

const login = new Date('2026-03-01T12:00:00.000Z');
const session = {
  lastUsedAt: login,
  expiresAt: new Date('2026-03-31T12:00:00.000Z'),
  endedAt: null,
};

describe('isSessionValid', () => {
  it('vale até 7 dias sem uso, e não depois', () => {
    expect(isSessionValid(session, new Date('2026-03-08T12:00:00.000Z'), 7)).toBe(true);
    expect(isSessionValid(session, new Date('2026-03-08T12:00:01.000Z'), 7)).toBe(false);
  });

  it('o uso recente não passa do prazo máximo', () => {
    const recentlyUsed = { ...session, lastUsedAt: new Date('2026-03-31T11:00:00.000Z') };
    expect(isSessionValid(recentlyUsed, new Date('2026-03-31T12:00:00.000Z'), 7)).toBe(true);
    expect(isSessionValid(recentlyUsed, new Date('2026-03-31T12:00:01.000Z'), 7)).toBe(false);
  });

  it('não vale depois de encerrada', () => {
    const ended = { ...session, endedAt: new Date('2026-03-02T12:00:00.000Z') };
    expect(isSessionValid(ended, new Date('2026-03-02T12:00:01.000Z'), 7)).toBe(false);
  });
});

describe('shouldRecordUse', () => {
  it('grava o último uso no máximo uma vez por minuto', () => {
    expect(shouldRecordUse(login, new Date('2026-03-01T12:00:59.999Z'))).toBe(false);
    expect(shouldRecordUse(login, new Date('2026-03-01T12:01:00.000Z'))).toBe(true);
  });
});
