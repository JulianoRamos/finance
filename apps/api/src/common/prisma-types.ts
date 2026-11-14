import { Prisma } from '../generated/prisma/client.js';

// Os tipos do cliente gerado do Prisma que os módulos usam. Só o common importa o cliente gerado.

/** O decimal do Prisma, com que ele lê o dinheiro e as quantidades (colunas numeric). */
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Um valor que o Prisma grava numa coluna jsonb. */
export type JsonValue = Prisma.InputJsonValue | null;
/** Um objeto que o Prisma grava numa coluna jsonb. */
export type JsonObject = Prisma.InputJsonObject;

export { AuditAction, EntityType, LoginStep, Operation } from '../generated/prisma/client.js';

/** Se o erro é a violação de um único do banco (P2002 do Prisma), como um e-mail que já existe. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
