import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  type AccountType,
  activeIs,
  apiError,
  calendarDateOf,
  type Clock,
  CLOCK,
  hasEntityLevel,
  currentVisibleEntityIds,
  Decimal,
  formatCalendarDate,
  type Institution,
  type MovementDirection,
  type MovementSource,
  NAME_COLLATION,
  nameMatches,
  type PageRequest,
  requireCalendarDate,
  type PermissionLevel,
  readFirst,
  readPage,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AuditHistoryService, type AuditHistoryPage, AuditService, type HistorySource } from '../audit/index.js';
import { EntitiesService } from '../entities/index.js';
import type {
  Account,
  AccountBalance,
  AccountEdit,
  AccountPage,
  Movement,
  MovementPage,
  NewAccount,
  NewAdjustment,
  NewMovement,
} from './accounts.dto.js';
import { MOVEMENT_AMOUNT_RANGE } from './accounts.dto.js';

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

/** A movimentação como o Prisma a lê. */
interface MovementRow {
  readonly id: string;
  readonly date: Date;
  readonly description: string;
  readonly amount: Decimal;
  readonly direction: MovementDirection;
  readonly source: MovementSource;
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

/** O que outro módulo lê de uma conta em que grava registros, como as parcelas (LLD, seção 3). */
export interface AccountSummary {
  readonly entityId: string;
  readonly name: string;
  readonly active: boolean;
}

/**
 * A ordem da lista das movimentações: da mais recente para a mais antiga pela data e, no mesmo dia, pela
 * ordem do registro, a última primeiro (o uuidv7 do id cresce com o registro).
 */
const MOVEMENT_ORDER = sql`date DESC, created_at DESC, id DESC`;

/** A ordem da lista das contas: as ativas primeiro, e cada grupo pelo nome. */
const ACCOUNT_ORDER = sql`active DESC, name ${NAME_COLLATION}`;

/** A conta como a rota a devolve, com o nome da entidade dona e o saldo de hoje. */
function toAccount(row: AccountRow, entityName: string, balance: Decimal): Account {
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
    balance: balance.toFixed(2),
    active: row.active,
    version: row.version,
  };
}

/** A movimentação como a rota a devolve. */
function toMovement(row: MovementRow): Movement {
  return {
    id: row.id,
    date: formatCalendarDate(row.date),
    description: row.description,
    amount: row.amount.toFixed(2),
    direction: row.direction,
    source: row.source,
  };
}

/** A recusa da entidade desativada, que não recebe nada novo (regra 6.2). */
function inactiveEntity(message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'INACTIVE_ENTITY', message);
}

/**
 * As tabelas e os campos do histórico da conta (LLD, seção 4.4): a própria conta e as movimentações dela,
 * achadas pela conta do registro gravado. O id, a entidade dona e a conta, que não mudam, os instantes de
 * criação e de alteração e a versão não entram.
 */
const HISTORY_SOURCES: readonly HistorySource[] = [
  {
    tableName: 'account',
    fields: ['name', 'type', 'institution', 'isReserve', 'openingBalance', 'openingBalanceDate', 'active'],
  },
  {
    tableName: 'movement',
    fields: ['date', 'description', 'amount', 'direction', 'source'],
    recordField: 'accountId',
  },
];

/** A recusa da data antes da do saldo inicial, quando a conta ainda não tinha saldo (regra 6.3). */
function dateBeforeOpeningBalance() {
  return apiError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'DATE_BEFORE_OPENING_BALANCE',
    'A conta ainda não tinha saldo nesse dia: escolha uma data a partir da do saldo inicial.',
  );
}

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

/** Confere o nível do usuário da requisição na entidade (regra 6.1), ou recusa com 403. */
async function requireEntityLevel(entityId: string, required: PermissionLevel): Promise<void> {
  if (!(await hasEntityLevel(entityId, required))) throw forbidden(required);
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
          AND ${activeIs(filter.active)}
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

  /**
   * A dona, o nome e o estado de cada conta dos ids, para outro módulo (LLD, seção 3). Com `lock`, trava as
   * contas até o fim da transação, para a desativação esperar a gravação de quem as usa.
   */
  async summariesOf(
    ids: readonly string[],
    options: { lock?: boolean } = {},
  ): Promise<ReadonlyMap<string, AccountSummary>> {
    if (ids.length === 0) return new Map();
    const lock = options.lock ? sql`FOR SHARE` : sql``;
    const rows = await this.transactions.client.$queryRaw<(AccountSummary & { id: string })[]>`
      SELECT id::text AS id, entity_id::text AS "entityId", name, active
      FROM account WHERE id = ANY(${[...ids]}::uuid[]) ${lock}`;
    return new Map(rows.map(({ id, ...summary }) => [id, summary]));
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
    // O id lido, e não o da rota, que pode vir em maiúsculas: as movimentações casam pelo texto dele.
    const account = await this.readWithLevel(id, 'view');
    return this.auditHistory.recordHistory(account.id, { sources: HISTORY_SOURCES }, page);
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
          openingBalanceDate: requireCalendarDate(input.openingBalanceDate),
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
      if (!owner.active) throw inactiveEntity('Uma entidade desativada não recebe conta nova. Reative-a antes.');
      const now = this.clock.now();
      const created = await this.transactions.client.account.create({
        data: {
          entityId,
          name: input.name.trim(),
          type: input.type,
          institution: input.institution,
          isReserve: input.isReserve,
          openingBalance: input.openingBalance,
          openingBalanceDate: requireCalendarDate(input.openingBalanceDate),
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
      // A conta acabou de nascer, sem movimentações: o saldo de hoje é o inicial.
      return toAccount(created, owner.name, created.openingBalance);
    });
  }

  /**
   * O saldo da conta no fim do dia dado, ou de hoje, quando o usuário tem `view` na entidade dona: o
   * saldo inicial mais as entradas menos as saídas da data do saldo inicial até o dia, inclusive (regra
   * 6.3). Um dia antes da data do saldo inicial não tem saldo.
   */
  async balance(accountId: string, dateText: string | undefined): Promise<AccountBalance> {
    const account = await this.readWithLevel(accountId, 'view');
    const date = dateText === undefined ? calendarDateOf(this.clock.now()) : requireCalendarDate(dateText);
    return { date: formatCalendarDate(date), balance: (await this.balanceOn(account, date)).toFixed(2) };
  }

  /**
   * A página das movimentações da conta, quando o usuário tem `view` na entidade dona, da mais recente
   * para a mais antiga pela data e, no mesmo dia, pela ordem do registro.
   */
  async movements(accountId: string, page: PageRequest): Promise<MovementPage> {
    const account = await this.readWithLevel(accountId, 'view');
    const client = this.transactions.client;
    return readPage(
      client,
      sql`SELECT id, date, created_at FROM movement WHERE account_id = ${account.id}::uuid`,
      MOVEMENT_ORDER,
      page,
      async (ids) => (await client.movement.findMany({ where: { id: { in: ids } } })).map(toMovement),
    );
  }

  /**
   * Registra uma movimentação manual na conta, quando o usuário tem `operate` na entidade dona. A conta
   * desativada e a de uma entidade desativada não recebem movimentação nova (LLD, seção 4.5).
   */
  createMovement(accountId: string, input: NewMovement): Promise<Movement> {
    return this.transactions.run(async () => {
      // A trava compartilhada segura a desativação da conta e o ajuste, que a travam para alterar, até a
      // movimentação ser gravada, e a leitura depois dela já vê o que veio antes.
      await this.transactions.client.$queryRaw`SELECT 1 FROM account WHERE id = ${accountId}::uuid FOR SHARE`;
      const account = await this.readReceivingMovements(accountId);
      return this.insertMovement(account, {
        date: requireCalendarDate(input.date),
        amount: new Decimal(input.amount),
        direction: input.direction,
        description: input.description.trim(),
        source: 'manual',
      });
    });
  }

  /**
   * Registra o ajuste do saldo da conta numa data, quando o usuário tem `operate` na entidade dona: a
   * diferença entre o saldo do banco e o calculado no fim do dia, como uma movimentação de origem
   * `adjustment` nesse dia, com o motivo na descrição (regra 6.3). As recusas da conta e da entidade
   * desativadas são as da movimentação manual.
   */
  createAdjustment(accountId: string, input: NewAdjustment): Promise<Movement> {
    return this.transactions.run(async () => {
      // A trava exclusiva vai do cálculo do saldo à gravação: outro ajuste ou movimentação da mesma conta,
      // que a travam também, espera, e não muda o saldo entre os dois.
      await this.transactions.client.$queryRaw`SELECT 1 FROM account WHERE id = ${accountId}::uuid FOR UPDATE`;
      const account = await this.readReceivingMovements(accountId);
      const date = requireCalendarDate(input.date);
      const difference = new Decimal(input.bankBalance).minus(await this.balanceOn(account, date));
      if (difference.isZero()) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'BALANCE_ALREADY_MATCHES',
          'O saldo do banco já é o saldo calculado nesse dia: não há o que ajustar.',
        );
      }
      // A diferença é o valor da movimentação, que tem o limite de um valor de movimentação (LLD, seção 4.1).
      if (difference.abs().greaterThan(MOVEMENT_AMOUNT_RANGE.atMost)) {
        const message = 'A diferença para o saldo calculado passa do maior valor de uma movimentação.';
        throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', message, { bankBalance: message });
      }
      return this.insertMovement(account, {
        date,
        amount: difference.abs(),
        direction: difference.isPositive() ? 'inflow' : 'outflow',
        description: input.reason.trim(),
        source: 'adjustment',
      });
    });
  }

  /**
   * A conta do id, quando o usuário tem `operate` na entidade dona e as duas estão ativas: a conta
   * desativada e a de uma entidade desativada não recebem movimentação nova (LLD, seção 4.5).
   */
  private async readReceivingMovements(accountId: string) {
    const account = await this.readWithLevel(accountId, 'operate');
    if (!account.active) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INACTIVE_ACCOUNT',
        'Uma conta desativada não recebe movimentação nova. Reative-a antes.',
      );
    }
    const owner = (await this.entities.summariesOf([account.entityId], { lock: true })).get(account.entityId);
    if (!owner?.active) {
      throw inactiveEntity('A entidade desta conta está desativada e não recebe movimentação nova. Reative-a antes.');
    }
    return account;
  }

  /** Grava a movimentação na conta, com a auditoria da criação, e a devolve como a rota. */
  private async insertMovement(
    account: AccountRow,
    data: Pick<MovementRow, 'date' | 'amount' | 'direction' | 'description' | 'source'>,
  ): Promise<Movement> {
    const now = this.clock.now();
    const created = await this.transactions.client.movement.create({
      data: { ...data, accountId: account.id, createdAt: now, updatedAt: now },
    });
    await this.audit.record({
      action: 'create',
      tableName: 'movement',
      recordId: created.id,
      entityId: account.entityId,
      before: null,
      after: created,
    });
    return toMovement(created);
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

  /**
   * As contas como a rota as devolve, com os nomes das entidades donas, pedidos às Entidades, e o saldo de
   * hoje de cada uma, numa consulta só.
   */
  private async withEntityNames(rows: readonly AccountRow[]): Promise<Account[]> {
    const [owners, balances] = await Promise.all([
      this.entities.summariesOf([...new Set(rows.map((row) => row.entityId))]),
      this.balancesOf(
        rows.map((row) => row.id),
        calendarDateOf(this.clock.now()),
      ),
    ]);
    return rows.map((row) =>
      toAccount(row, owners.get(row.entityId)?.name ?? '', balances.get(row.id) ?? row.openingBalance),
    );
  }

  /** O saldo da conta no fim do dia, ou a recusa do dia antes da data do saldo inicial, que não tem saldo. */
  private async balanceOn(account: AccountRow, date: Date): Promise<Decimal> {
    if (date < account.openingBalanceDate) throw dateBeforeOpeningBalance();
    return (await this.balancesOf([account.id], date)).get(account.id) ?? account.openingBalance;
  }

  /**
   * O saldo de cada conta no fim do dia: o saldo inicial mais as entradas menos as saídas da data do saldo
   * inicial até o dia, inclusive (regra 6.3). A movimentação de antes do saldo inicial não entra.
   */
  private async balancesOf(ids: readonly string[], date: Date): Promise<ReadonlyMap<string, Decimal>> {
    if (ids.length === 0) return new Map();
    // O dia vai como o texto `AAAA-MM-DD`: um `Date` chegaria como instante, e o `::date` o leria no fuso
    // da sessão do banco, que pode mudar o dia.
    const day = formatCalendarDate(date);
    const rows = await this.transactions.client.$queryRaw<{ id: string; balance: Decimal }[]>`
      SELECT a.id::text AS id,
        a.opening_balance + COALESCE(SUM(CASE m.direction WHEN 'inflow' THEN m.amount ELSE -m.amount END), 0)
          AS balance
      FROM account a
      LEFT JOIN movement m ON m.account_id = a.id AND m.date >= a.opening_balance_date AND m.date <= ${day}::date
      WHERE a.id = ANY(${[...ids]}::uuid[])
      GROUP BY a.id`;
    return new Map(rows.map((row) => [row.id, row.balance]));
  }
}
