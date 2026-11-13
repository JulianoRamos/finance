import { describe, expect, it } from 'vitest';

import { EMAIL_LIMIT, isBlocked } from './login-limit.js';

/** O instante `minutes` minutos depois das 12h de 1º de março de 2026, em UTC. */
function at(minutes: number): Date {
  return new Date(Date.UTC(2026, 2, 1, 12, minutes));
}

describe('isBlocked', () => {
  it('cinco falhas em 15 minutos bloqueiam por 15 minutos a partir da quinta', () => {
    const failures = [at(0), at(3), at(6), at(9), at(12)];

    expect(isBlocked(failures, at(12), EMAIL_LIMIT)).toBe(true);
    expect(isBlocked(failures, new Date(at(27).getTime() - 1), EMAIL_LIMIT)).toBe(true);
    expect(isBlocked(failures, at(27), EMAIL_LIMIT)).toBe(false);
  });

  it('quatro falhas não bloqueiam', () => {
    expect(isBlocked([at(0), at(1), at(2), at(3)], at(4), EMAIL_LIMIT)).toBe(false);
  });

  it('cinco falhas espalhadas por mais de 15 minutos não bloqueiam', () => {
    expect(isBlocked([at(0), at(4), at(8), at(12), at(16)], at(16), EMAIL_LIMIT)).toBe(false);
  });

  it('confere as falhas em qualquer ordem', () => {
    expect(isBlocked([at(12), at(0), at(9), at(3), at(6)], at(13), EMAIL_LIMIT)).toBe(true);
  });
});
