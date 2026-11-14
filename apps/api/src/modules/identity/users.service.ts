import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  type Clock,
  CLOCK,
  isUniqueViolation,
  NAME_COLLATION,
  nameMatches,
  type Page,
  type PageRequest,
  readPage,
  searchPattern,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import { isEmail, normalizeEmail } from './email.js';
import type { User } from './identity.dto.js';
import { IdentityError } from './identity-error.js';

/** Um usuário novo. */
export interface NewUser {
  readonly name: string;
  readonly email: string;
  /** Se ele gere usuários e acessos (regra 6.1). */
  readonly managesAccess: boolean;
}

/** O usuário como o Prisma o lê. */
export interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly managesAccess: boolean;
  readonly active: boolean;
  readonly version: number;
}

/** O que a edição, a desativação e a gravação dos acessos mudam no usuário, já normalizado. */
export interface UserChanges {
  readonly name?: string;
  readonly email?: string;
  readonly active?: boolean;
  readonly managesAccess?: boolean;
}

/** O usuário como a rota o devolve, sem o hash da senha. */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    managesAccess: row.managesAccess,
    active: row.active,
    passwordSet: row.passwordHash !== null,
    version: row.version,
  };
}

/** A recusa do e-mail que já é de outro usuário, ativo ou não. */
function duplicateEmail(email: string) {
  return new IdentityError(`Já existe um usuário com o e-mail ${email}.`, 'DUPLICATE_EMAIL');
}

/** O dono da tabela `user`: as leituras e as alterações, com a auditoria delas. */
@Injectable()
export class UsersService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** O usuário do e-mail, comparado sem distinguir maiúsculas, ou nulo. */
  findByEmail(email: string) {
    return this.transactions.client.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  /**
   * A página dos usuários, os ativos primeiro e cada grupo pelo nome. A busca acha o nome e o e-mail
   * sem acento e sem diferença de maiúsculas.
   */
  list(filter: { q?: string | undefined; page: PageRequest }): Promise<Page<User>> {
    const pattern = searchPattern(filter.q);
    const client = this.transactions.client;
    return readPage(
      client,
      sql`SELECT id, active, name FROM "user"
        WHERE ${nameMatches(filter.q)}
          OR unaccent(lower(email)) LIKE unaccent(lower(${pattern}::text)) ESCAPE '\\'`,
      sql`active DESC, name ${NAME_COLLATION}`,
      filter.page,
      async (ids) => (await client.user.findMany({ where: { id: { in: ids } } })).map(toUser),
    );
  }

  /** O usuário do id, como a rota o devolve, ou a recusa 404. */
  async get(id: string): Promise<User> {
    return toUser(await this.read(id));
  }

  /** O usuário do id, ativo ou desativado, ou a recusa 404. */
  async read(id: string): Promise<UserRow> {
    const row = await this.transactions.client.user.findUnique({ where: { id } });
    if (!row) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Este usuário não existe.');
    return row;
  }

  /**
   * Cria o usuário, sem senha. Recusa um nome vazio, um e-mail inválido e um e-mail que já é de outro
   * (`DUPLICATE_EMAIL`).
   */
  create(user: NewUser) {
    const name = user.name.trim();
    const email = normalizeEmail(user.email);
    if (!name) throw new IdentityError('Informe o nome do usuário.');
    if (!isEmail(email)) throw new IdentityError(`O e-mail ${email} não é válido.`);
    return this.transactions.run(async () => {
      if (await this.findByEmail(email)) throw duplicateEmail(email);
      const now = this.clock.now();
      const created = await this.transactions.client.user
        .create({ data: { name, email, managesAccess: user.managesAccess, createdAt: now, updatedAt: now } })
        .catch((error: unknown) => {
          // Outro pedido criou o mesmo e-mail entre a consulta e a criação.
          throw isUniqueViolation(error) ? duplicateEmail(email) : error;
        });
      await this.audit.record({
        action: 'create',
        tableName: 'user',
        recordId: created.id,
        entityId: null,
        before: null,
        after: created,
      });
      return created;
    });
  }

  /**
   * Grava as mudanças no usuário lido, na versão seguinte, com a auditoria. A versão vai no filtro: se
   * outro pedido mudou o usuário depois da leitura, nada é gravado, e a resposta é o conflito. Um e-mail
   * que já é de outro usuário responde `DUPLICATE_EMAIL`.
   */
  update(before: UserRow, changes: UserChanges): Promise<UserRow> {
    return this.transactions.run(async () => {
      const { count } = await this.transactions.client.user
        .updateMany({
          where: { id: before.id, version: before.version },
          data: { ...changes, updatedAt: this.clock.now(), version: { increment: 1 } },
        })
        .catch((error: unknown) => {
          throw isUniqueViolation(error) && changes.email !== undefined ? duplicateEmail(changes.email) : error;
        });
      if (count === 0) throw versionConflict();
      const after = await this.read(before.id);
      await this.audit.record({
        action: 'update',
        tableName: 'user',
        recordId: before.id,
        entityId: null,
        before: { ...before },
        after: { ...after },
      });
      return after;
    });
  }

  /** Grava o hash da senha nova do usuário, lido antes como `before`. */
  setPassword(before: { readonly id: string } & Record<string, unknown>, passwordHash: string): Promise<void> {
    return this.transactions.run(async () => {
      const after = await this.transactions.client.user.update({
        where: { id: before.id },
        data: { passwordHash, updatedAt: this.clock.now(), version: { increment: 1 } },
      });
      await this.audit.record({
        action: 'update',
        tableName: 'user',
        recordId: before.id,
        entityId: null,
        before,
        after,
      });
    });
  }
}

/** A recusa da versão que não é a atual (regra 6.20). */
export function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Este usuário mudou desde que você o abriu. Recarregue para ver os dados atuais.',
  );
}
