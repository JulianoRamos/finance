import { ValidateBy, type ValidationOptions } from 'class-validator';

// A data de calendário, sem hora nem fuso, que trafega como `AAAA-MM-DD` e fica numa coluna `date`.
// No código, ela é o `Date` da meia-noite UTC desse dia, como o Prisma lê e grava a coluna.

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** O `Date` da meia-noite UTC do dia em `AAAA-MM-DD`, ou nulo quando o texto não é um dia que existe. */
export function parseCalendarDate(text: unknown): Date | null {
  if (typeof text !== 'string') return null;
  const match = CALENDAR_DATE.exec(text);
  if (!match) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  // O `Date` aceita 31/02 e o leva para março: o dia só existe se volta igual.
  return Number.isNaN(date.getTime()) || formatCalendarDate(date) !== text ? null : date;
}

/** O dia de uma data que o DTO já validou; a que chega sem validação é um erro do código. */
export function requireCalendarDate(text: string): Date {
  const date = parseCalendarDate(text);
  if (!date) throw new Error('A data chegou ao serviço sem passar pela validação.');
  return date;
}

/** O dia do `Date`, lido em UTC, como `AAAA-MM-DD`. */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * O dia do instante no fuso do processo (`TZ`, LLD, seção 9), como o `Date` da meia-noite UTC desse dia:
 * o "hoje" da api, quando o instante é o do relógio.
 */
export function calendarDateOf(instant: Date): Date {
  return new Date(Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate()));
}

/** O campo é uma data `AAAA-MM-DD` que existe. */
export function IsCalendarDate(options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    { name: 'isCalendarDate', validator: { validate: (value) => parseCalendarDate(value) !== null } },
    options,
  );
}

/**
 * O campo, quando é uma data, não vem antes da data do campo dado. Quando um dos dois não é uma data, a
 * recusa é a do validador da data.
 */
export function IsNotBefore(property: string, options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNotBefore',
      constraints: [property],
      validator: {
        validate: (value, args) => {
          const start = parseCalendarDate((args?.object as Record<string, unknown> | undefined)?.[property]);
          const end = parseCalendarDate(value);
          return start === null || end === null || end >= start;
        },
      },
    },
    options,
  );
}

const CALENDAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Um mês de calendário: o primeiro dia dele e o primeiro do seguinte, as datas da meia-noite UTC. */
export interface CalendarMonth {
  readonly start: Date;
  readonly next: Date;
}

/** O mês em `AAAA-MM`, ou nulo quando o texto não é um mês. */
export function parseCalendarMonth(text: unknown): CalendarMonth | null {
  if (typeof text !== 'string') return null;
  const match = CALENDAR_MONTH.exec(text);
  if (!match) return null;
  return monthOf(Number(match[1]), Number(match[2]) - 1);
}

/** O mês do instante no fuso do processo: o mês de hoje da api, quando o instante é o do relógio. */
export function calendarMonthOfInstant(instant: Date): CalendarMonth {
  return monthOf(instant.getFullYear(), instant.getMonth());
}

/** O mês do ano e do número dado, a partir de 0. */
function monthOf(year: number, month: number): CalendarMonth {
  return { start: new Date(Date.UTC(year, month, 1)), next: new Date(Date.UTC(year, month + 1, 1)) };
}

/** O campo é um mês `AAAA-MM`. */
export function IsCalendarMonth(options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    { name: 'isCalendarMonth', validator: { validate: (value) => parseCalendarMonth(value) !== null } },
    options,
  );
}
