/** O token do relógio da api na injeção de dependências. */
export const CLOCK = Symbol('CLOCK');

/**
 * O relógio da api: de onde os módulos leem o instante que gravam ou conferem. Os testes o trocam por
 * um relógio que eles avançam, para provar os prazos sem esperar.
 */
export interface Clock {
  now(): Date;
}

/** O relógio do sistema, o de produção. */
export const systemClock: Clock = { now: () => new Date() };
