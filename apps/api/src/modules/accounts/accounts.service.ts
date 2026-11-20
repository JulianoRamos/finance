import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  type AccountType,
  apiError,
  type Clock,
  CLOCK,
  currentEntityLevels,
  currentVisibleEntityIds,
  Decimal,
  formatCalendarDate,
  type Institution,
  NAME_COLLATION,
  nameMatches,
  type PageRequest,
  parseCalendarDate,
  type PermissionLevel,
  readFirst,
  readPage,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AuditHistoryService, type AuditHistoryPage, AuditService, type HistorySource } from '../audit/index.js';
import { EntitiesService } from '../entities/index.js';
import type { Account, AccountEdit, AccountPage, NewAccount } from './accounts.dto.js';

/** A conta como o Prisma a lê. */
interface AccountRow {
  readonly id: string;
  readonly entityId: string;
  readonly name: string;
  readonly type: AccountType;
  readonly institution: Institution;
  readonly isReserve: boolean;
  readonly openingBalance: Decimal;
  readonly openingBalanceDate: Date;
  readonly active: boolean;
  readonly version: number;
}

/** A conta como a pesquisa a devolve, com o nome da entidade dona (regra 6.22). */
export interface AccountSearchResult {
  readonly id: string;
  readonly name: string;
  readonly entityName: string;
  readonly institution: Institution;
  readonly isReserve: boolean;
  readonly active: boolean;
}

/** A ordem da lista das contas: as ativas primeiro, e cada grupo pelo nome. */
const ACCOUNT_ORDER = sql`active DESC, name ${NAME_COLLATION}`;

/** A conta como a rota a devolve, com o nome da entidade dona. */
function toAccount(row: AccountRow, entityName: string): Account {
  return {
    id: row.id,
    entityId: row.entityId,
    entityName,
    name: row.name,
    type: row.type,
    institution: row.institution,
    isReserve: row.isReserve,
    openingBalance: row.openingBalance.toFixed(2),
    openingBalanceDate: formatCalendarDate(row.openingBalanceDate),
    active: row.active,
    version: row.version,
  };
}

/**
 * A tabela e os campos do histórico da conta (LLD, seção 4.4): só a própria conta, por enquanto. O id, a
 * entidade dona, que não muda, os instantes de criação e de alteração e a versão não entram.
 */
const HISTORY_SOURCES: readonly HistorySource[] = [
  {
    tableName: 'account',
    fields: ['name', 'type', 'institution', 'isReserve', 'openingBalance', 'openingBalanceDate', 'active'],
  },
];

/** A recusa da conta que não existe. */
function accountNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Esta conta não existe.');
}

/** A recusa da versão que não é a atual (regra 6.20). */
function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Esta conta mudou desde que você a abriu. Recarregue para ver os dados atuais.',
  );
}

/** A recusa da falta do nível na entidade dona, que inclui a entidade que não existe (regra 6.1). */
function forbidden(required: PermissionLevel) {
  return apiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    required === 'view'
      ? 'Você não tem acesso à entidade desta conta.'
      : 'Você só pode ver as contas desta entidade, e não alterá-las.',
  );
}

/**
 * Confere o nível do usuário da requisição na entidade, pelas permissões que a autenticação já leu
 * (regra 6.1): `operate` vale também para ler.
 */
async function requireEntityLevel(entityId: string, required: PermissionLevel): Promise<void> {
  const level = (await currentEntityLevels()).get(entityId.toLowerCase());
  if (level === undefined || (required === 'operate' && level !== 'operate')) throw forbidden(required);
}

/**
 * O dono da tabela `account`: as contas de cada entidade, com o saldo inicial (LLD, seção 4.5). A
 * permissão é a da entidade dona, e o nome dela vem das Entidades.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly auditHistory: AuditHistoryService,
    private readonly entities: EntitiesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * A página das contas das entidades dadas, as ativas primeiro e cada grupo pelo nome; com `active`,
   * só as desse estado. A busca acha o nome sem acento.
   */
  async list(filter: {
    entityIds: readonly string[];
    active?: boolean | undefined;
    q?: string | undefined;
    page: PageRequest;
  }): Promise<AccountPage> {
    const client = this.transactions.client;
    return readPage(
      client,
      sql`SELECT id, active, name FROM account
        WHERE entity_id = ANY(${[...filter.entityIds]}::uuid[])
          AND (${filter.active ?? null}::boolean IS NULL OR active = ${filter.active ?? null}::boolean)
          AND ${nameMatches(filter.q)}`,
      ACCOUNT_ORDER,
      filter.page,
      async (ids) => this.withEntityNames(await client.account.findMany({ where: { id: { in: ids } } })),
    );
  }

  /**
   * As primeiras contas cujo nome tem o termo, sem acento nem diferença de maiúsculas, entre as das
   * entidades em que o usuário da requisição tem permissão, na ordem da lista (regra 6.22).
   */
  async search(term: string, limit: number): Promise<AccountSearchResult[]> {
    const visibleIds = await currentVisibleEntityIds();
    const client = this.transactions.client;
    return readFirst(
      client,
      sql`SELECT id, active, name FROM account WHERE entity_id = ANY(${visibleIds}::uuid[]) AND ${nameMatches(term)}`,
      ACCOUNT_ORDER,
      limit,
      async (ids) => {
        const rows = await client.account.findMany({
          where: { id: { in: ids } },
          select: { id: true, entityId: true, name: true, institution: true, isReserve: true, active: true },
        });
        const owners = await this.entities.summariesOf([...new Set(rows.map((row) => row.entityId))]);
        return rows.map(({ entityId, ...row }) => ({ ...row, entityName: owners.get(entityId)?.name ?? '' }));
      },
    );
  }

  /** A conta do id, ativa ou desativada, quando o usuário tem `view` na entidade dona. */
  async get(id: string): Promise<Account> {
    return this.withEntityName(await this.readWithLevel(id, 'view'));
  }

  /**
   * A página do histórico de alterações da conta, da auditoria (LLD, seção 4.4), quando o usuário tem
   * `view` na entidade dona.
   */
  async history(id: string, page: PageRequest): Promise<AuditHistoryPage> {
    await this.readWithLevel(id, 'view');
    return this.auditHistory.recordHistory(id, { sources: HISTORY_SOURCES }, page);
  }

  /**
   * Troca os dados da conta, com a versão lida, quando o usuário tem `operate` na entidade dona. A dona
   * não muda: a edição manda a atual (LLD, seção 4.5).
   */
  update(id: string, input: AccountEdit): Promise<Account> {
    return this.transactions.run(async () => {
      const before = await this.readWithLevel(id, 'operate');
      if (before.version !== input.version) throw versionConflict();
      if (before.entityId !== input.entityId.toLowerCase()) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'ACCOUNT_OWNER_IMMUTABLE',
          'A entidade dona da conta não muda depois do cadastro. Para outra dona, cadastre outra conta.',
        );
      }
      return this.withEntityName(
        await this.updateVersioned(before, {
          name: input.name.trim(),
          type: input.type,
          institution: input.institution,
          isReserve: input.isReserve,
          openingBalance: new Decimal(input.openingBalance),
          openingBalanceDate: openingBalanceDate(input.openingBalanceDate),
        }),
      );
    });
  }

  /**
   * Desativa ou reativa a conta, com a versão lida, quando o usuário tem `operate` na entidade dona.
   * Pedir o estado que ela já tem não muda nada, e responde com ela mesmo de uma versão antiga, como a de
   * outra aba que pediu o mesmo. Desativar não apaga nada (regra 6.20).
   */
  setActive(id: string, active: boolean, version: number): Promise<Account> {
    return this.transactions.run(async () => {
      const before = await this.readWithLevel(id, 'operate');
      if (before.active === active) return this.withEntityName(before);
      if (before.version !== version) throw versionConflict();
      return this.withEntityName(await this.updateVersioned(before, { active }));
    });
  }

  /**
   * Cria a conta, ativa e na versão 1, na entidade em que o usuário tem `operate`. A entidade
   * desativada não recebe conta nova.
   */
  async create(input: NewAccount): Promise<Account> {
    const entityId = input.entityId.toLowerCase();
    await requireEntityLevel(entityId, 'operate');
    return this.transactions.run(async () => {
      const owner = (await this.entities.summariesOf([entityId], { lock: true })).get(entityId);
      if (!owner) throw forbidden('operate');
      if (!owner.active) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INACTIVE_ENTITY',
          'Uma entidade desativada não recebe conta nova. Reative-a antes.',
        );
      }
      const now = this.clock.now();
      const created = await this.transactions.client.account.create({
        data: {
          entityId,
          name: input.name.trim(),
          type: input.type,
          institution: input.institution,
          isReserve: input.isReserve,
          openingBalance: input.openingBalance,
          openingBalanceDate: openingBalanceDate(input.openingBalanceDate),
          createdAt: now,
          updatedAt: now,
        },
      });
      await this.audit.record({
        action: 'create',
        tableName: 'account',
        recordId: created.id,
        entityId,
        before: null,
        after: created,
      });
      return toAccount(created, owner.name);
    });
  }

  /**
   * Grava os dados na conta lida, na versão seguinte, com a auditoria. A versão vai no filtro: se outro
   * pedido mudou a conta depois da leitura, nada é gravado, e a resposta é o conflito.
   */
  private async updateVersioned(before: AccountRow, data: Partial<Omit<AccountRow, 'id' | 'entityId' | 'version'>>) {
    const { count } = await this.transactions.client.account.updateMany({
      where: { id: before.id, version: before.version },
      data: { ...data, updatedAt: this.clock.now(), version: { increment: 1 } },
    });
    if (count === 0) throw versionConflict();
    const after = await this.read(before.id);
    await this.audit.record({
      action: 'update',
      tableName: 'account',
      recordId: before.id,
      entityId: before.entityId,
      // A cópia é um objeto simples, que a auditoria aceita; a interface da linha não tem índice.
      before: { ...before },
      after,
    });
    return after;
  }

  /** A conta do id, quando o usuário tem o nível na entidade dona, ou a recusa: 404 ou 403. */
  private async readWithLevel(id: string, required: PermissionLevel) {
    const row = await this.read(id);
    await requireEntityLevel(row.entityId, required);
    return row;
  }

  /** A conta do id, ou a recusa 404. */
  private async read(id: string) {
    const row = await this.transactions.client.account.findUnique({ where: { id } });
    if (!row) throw accountNotFound();
    return row;
  }

  /** A conta como a rota a devolve, com o nome da entidade dona. */
  private async withEntityName(row: AccountRow): Promise<Account> {
    const [account] = await this.withEntityNames([row]);
    if (!account) throw new Error('A conta não tem a entidade dona.');
    return account;
  }

  /** As contas como a rota as devolve, com os nomes das entidades donas, pedidos às Entidades. */
  private async withEntityNames(rows: readonly AccountRow[]): Promise<Account[]> {
    const owners = await this.entities.summariesOf([...new Set(rows.map((row) => row.entityId))]);
    return rows.map((row) => toAccount(row, owners.get(row.entityId)?.name ?? ''));
  }
}

/** O dia do saldo inicial, já validado pelo DTO. */
function openingBalanceDate(text: string): Date {
  const date = parseCalendarDate(text);
  if (!date) throw new Error('A data do saldo inicial chegou ao serviço sem passar pela validação.');
  return date;
}
