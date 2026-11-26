import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  calendarDateOf,
  type CalendarMonth,
  type Clock,
  CLOCK,
  Decimal,
  type EntryPurpose,
  type EntryType,
  formatCalendarDate,
  type FinancialContextEntityRow,
  hasEntityLevel,
  type MovementDirection,
  type PageRequest,
  type PermissionLevel,
  readPage,
  requireCalendarDate,
  sql,
  textMatches,
  TransactionService,
} from '../../common/index.js';
import { AccountsService } from '../accounts/index.js';
import { AuditService } from '../audit/index.js';
import { EntitiesService } from '../entities/index.js';
import { CategoriesService } from './categories.service.js';
import type { Entry, EntryMonthItem, EntryMonthPage, InstallmentPage, NewEntry } from './entries.dto.js';
import { dueInMonth, installmentStatus, planInstallments } from './installments.js';

/** O lançamento como a leitura o monta, com os nomes da categoria e do pai e o número de parcelas. */
interface EntryRow {
  readonly id: string;
  readonly entityId: string;
  readonly type: EntryType;
  readonly description: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly categoryParentName: string | null;
  readonly purpose: EntryPurpose | null;
  readonly occurredOn: Date;
  readonly totalAmount: Decimal;
  readonly installmentCount: number;
  readonly version: number;
}

/** A parcela do mês como a leitura a monta, com o lançamento dela. */
interface MonthRow {
  readonly id: string;
  readonly entryId: string;
  readonly entityId: string;
  readonly type: EntryType;
  readonly description: string;
  readonly categoryName: string;
  readonly categoryParentName: string | null;
  readonly purpose: EntryPurpose | null;
  readonly number: number;
  readonly installmentCount: number;
  readonly dueDate: Date;
  readonly amount: Decimal;
  readonly reconciledAmount: Decimal;
}

/** O que a Conciliação lê de uma parcela para pagá-la (LLD, seção 4.8). */
export interface PaymentTarget {
  readonly id: string;
  readonly entityId: string;
  /** A descrição do lançamento. */
  readonly description: string;
  readonly number: number;
  readonly installmentCount: number;
  readonly amount: Decimal;
  readonly reconciledAmount: Decimal;
  readonly direction: MovementDirection;
}

/**
 * A ordem da lista do mês: pelo vencimento, da mais recente para a mais antiga e, no mesmo dia, pela ordem
 * do registro, a última primeiro, também no mesmo instante (o uuidv7 do id cresce com o registro).
 */
const MONTH_ORDER = sql`due_date DESC, created_at DESC, id DESC`;

/** As colunas do lançamento `e` que a lista e o detalhe trazem: a categoria `c`, o pai `p` e o número de parcelas. */
const ENTRY_COLUMNS = sql`e.entity_id::text AS "entityId", e.type::text AS type, e.description,
  c.name AS "categoryName", p.name AS "categoryParentName", e.purpose::text AS purpose,
  (SELECT count(*)::int FROM installment WHERE entry_id = e.id) AS "installmentCount"`;

/** O lançamento `e` com a categoria `c` e o pai dela `p`, para o caminho. */
const ENTRY_WITH_CATEGORY = sql`entry e
  JOIN category c ON c.id = e.category_id
  LEFT JOIN category p ON p.id = c.parent_id`;

/** O lançamento lido com os nomes da categoria e do pai e o número de parcelas, sem o filtro. */
const ENTRY_SELECT = sql`
  SELECT e.id::text AS id, ${ENTRY_COLUMNS}, e.category_id::text AS "categoryId",
    e.occurred_on AS "occurredOn", e.total_amount AS "totalAmount", e.version
  FROM ${ENTRY_WITH_CATEGORY}`;

/** A recusa da falta do nível na entidade dona, que inclui a entidade que não existe (regra 6.1). */
function forbidden(required: PermissionLevel) {
  return apiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    required === 'view'
      ? 'Você não tem acesso à entidade deste lançamento.'
      : 'Você só pode ver os lançamentos desta entidade, e não registrá-los.',
  );
}

/** Uma recusa do lançamento por uma regra de negócio (LLD, seção 4.6). */
function refused(code: string, message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
}

/** A recusa do lançamento que não existe. */
function notFound() {
  return apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Este lançamento não existe.');
}

/** Confere o nível do usuário da requisição na entidade (regra 6.1), ou recusa com 403. */
async function requireEntityLevel(entityId: string, required: PermissionLevel): Promise<void> {
  if (!(await hasEntityLevel(entityId, required))) throw forbidden(required);
}

/** O lançamento como a rota o devolve. */
function toEntry(row: EntryRow, entityName: string): Entry {
  return {
    id: row.id,
    entityId: row.entityId,
    entityName,
    type: row.type,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryParentName: row.categoryParentName,
    purpose: row.purpose,
    occurredOn: formatCalendarDate(row.occurredOn),
    totalAmount: row.totalAmount.toFixed(2),
    installmentCount: row.installmentCount,
    version: row.version,
  };
}

/**
 * O dono das tabelas `entry` e `installment`: os lançamentos de receita e de despesa das pessoas físicas,
 * com as parcelas (LLD, seção 4.6). A permissão é a da entidade dona; o nome e o tipo dela vêm das
 * Entidades, e a conta das parcelas, das Contas.
 */
@Injectable()
export class EntriesService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly entities: EntitiesService,
    private readonly accounts: AccountsService,
    private readonly categories: CategoriesService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Registra o lançamento, na versão 1, com as parcelas mensais a partir do primeiro vencimento e o total
   * dividido em centavos, com a diferença na primeira (regra 6.21), quando o usuário tem `operate` na
   * entidade dona. A dona é uma pessoa física ativa, a categoria é ativa e da natureza do tipo, e a conta
   * é ativa e da dona.
   */
  async create(input: NewEntry): Promise<Entry> {
    const entityId = input.entityId.toLowerCase();
    await requireEntityLevel(entityId, 'operate');
    return this.transactions.run(async () => {
      // As travas seguram a desativação da dona, da categoria e da conta até o lançamento ser gravado.
      const owner = (await this.entities.summariesOf([entityId], { lock: true })).get(entityId);
      if (!owner) throw forbidden('operate');
      if (owner.type !== 'individual') {
        throw refused(
          'ENTITY_NOT_INDIVIDUAL',
          'Os lançamentos de uma empresa entram com a clínica: escolha uma pessoa física.',
        );
      }
      if (!owner.active) {
        throw refused('INACTIVE_ENTITY', 'Uma entidade desativada não recebe lançamento novo. Reative-a antes.');
      }
      const category = await this.categories.summaryOf(input.categoryId.toLowerCase());
      if (!category) throw refused('INVALID_CATEGORY', 'A categoria escolhida não existe.');
      if (category.nature !== input.type) {
        throw refused(
          'CATEGORY_NATURE_MISMATCH',
          input.type === 'expense'
            ? 'A categoria escolhida é de receita: escolha uma categoria de despesa.'
            : 'A categoria escolhida é de despesa: escolha uma categoria de receita.',
        );
      }
      if (!category.active) {
        throw refused('INACTIVE_CATEGORY', 'A categoria escolhida está desativada. Reative-a ou escolha outra.');
      }
      const accountId = input.accountId.toLowerCase();
      const account = (await this.accounts.summariesOf([accountId], { lock: true })).get(accountId);
      if (account?.entityId !== entityId) {
        throw refused('INVALID_ACCOUNT', 'A conta escolhida não existe ou é de outra entidade.');
      }
      if (!account.active) {
        throw refused('INACTIVE_ACCOUNT', 'A conta escolhida está desativada. Reative-a ou escolha outra.');
      }

      const client = this.transactions.client;
      const now = this.clock.now();
      const totalAmount = new Decimal(input.totalAmount);
      const entry = await client.entry.create({
        data: {
          entityId,
          type: input.type,
          effect: input.type,
          description: input.description.trim(),
          categoryId: category.id,
          purpose: input.type === 'expense' ? (input.purpose ?? null) : null,
          occurredOn: requireCalendarDate(input.occurredOn),
          totalAmount,
          payerId: entityId,
          createdAt: now,
          updatedAt: now,
        },
      });
      // As parcelas e a auditoria delas vão numa instrução cada, e não numa por parcela: são até 120.
      const plan = planInstallments(totalAmount, input.installmentCount, requireCalendarDate(input.firstDueDate));
      const direction = input.type === 'expense' ? 'outflow' : 'inflow';
      const installments = await client.installment.createManyAndReturn({
        data: plan.map((planned) => ({
          ...planned,
          entryId: entry.id,
          accountId,
          direction,
          createdAt: now,
          updatedAt: now,
        })),
      });
      // A auditoria do lançamento e das parcelas vai numa instrução só, o lançamento primeiro.
      await this.audit.recordMany([
        { action: 'create', tableName: 'entry', recordId: entry.id, entityId, before: null, after: entry },
        ...installments
          .toSorted((a, b) => a.number - b.number)
          .map((installment) => ({
            action: 'create' as const,
            tableName: 'installment',
            recordId: installment.id,
            entityId,
            before: null,
            after: installment,
          })),
      ]);
      return toEntry(await this.read(entry.id), owner.name);
    });
  }

  /** O lançamento do id, quando o usuário tem `view` na entidade dona. */
  async get(id: string): Promise<Entry> {
    const row = await this.readWithLevel(id);
    const owner = (await this.entities.summariesOf([row.entityId])).get(row.entityId);
    return toEntry(row, owner?.name ?? '');
  }

  /**
   * A página das parcelas do lançamento, pelo número, com a situação de cada uma (regra 6.6), quando o
   * usuário tem `view` na entidade dona.
   */
  async installments(id: string, page: PageRequest): Promise<InstallmentPage> {
    const entry = await this.readWithLevel(id);
    const client = this.transactions.client;
    const today = calendarDateOf(this.clock.now());
    return readPage(
      client,
      sql`SELECT id, number FROM installment WHERE entry_id = ${entry.id}::uuid`,
      sql`number`,
      page,
      async (ids) => {
        const rows = await client.installment.findMany({ where: { id: { in: ids } } });
        const accounts = await this.accounts.summariesOf([...new Set(rows.map((row) => row.accountId))]);
        return rows.map((row) => ({
          id: row.id,
          number: row.number,
          dueDate: formatCalendarDate(row.dueDate),
          amount: row.amount.toFixed(2),
          accountId: row.accountId,
          accountName: accounts.get(row.accountId)?.name ?? '',
          status: installmentStatus(row, today),
        }));
      },
    );
  }

  /**
   * A página das parcelas que vencem no mês, cada uma com o lançamento dela, das pessoas físicas dadas,
   * pelo vencimento, da mais recente para a mais antiga, com o filtro de tipo e a busca na descrição. As
   * empresas ficam de fora, porque os lançamentos delas entram com a clínica.
   */
  async list(filter: {
    entities: readonly FinancialContextEntityRow[];
    month: CalendarMonth;
    type?: EntryType | undefined;
    q?: string | undefined;
    page: PageRequest;
  }): Promise<EntryMonthPage> {
    const client = this.transactions.client;
    const individuals = filter.entities.filter((entity) => entity.type === 'individual');
    const names = new Map(individuals.map((entity) => [entity.id, entity.name]));
    const type = filter.type ?? null;
    const today = calendarDateOf(this.clock.now());
    const page = await readPage(
      client,
      sql`SELECT i.id, i.due_date, i.created_at FROM installment i JOIN entry e ON e.id = i.entry_id
        WHERE e.entity_id = ANY(${[...names.keys()]}::uuid[])
          AND ${dueInMonth(sql`i.due_date`, filter.month)}
          AND (${type}::text IS NULL OR e.type::text = ${type}::text)
          AND ${textMatches(sql`e.description`, filter.q)}`,
      MONTH_ORDER,
      filter.page,
      async (ids) =>
        client.$queryRaw<MonthRow[]>`
          SELECT i.id::text AS id, e.id::text AS "entryId", ${ENTRY_COLUMNS},
            i.number, i.due_date AS "dueDate", i.amount, i.reconciled_amount AS "reconciledAmount"
          FROM ${ENTRY_WITH_CATEGORY} JOIN installment i ON i.entry_id = e.id
          WHERE i.id = ANY(${ids}::uuid[])`,
    );
    return {
      ...page,
      items: page.items.map((row): EntryMonthItem => ({
        entryId: row.entryId,
        installmentId: row.id,
        entityId: row.entityId,
        entityName: names.get(row.entityId) ?? '',
        type: row.type,
        description: row.description,
        categoryName: row.categoryName,
        categoryParentName: row.categoryParentName,
        purpose: row.purpose,
        number: row.number,
        installmentCount: row.installmentCount,
        dueDate: formatCalendarDate(row.dueDate),
        amount: row.amount.toFixed(2),
        status: installmentStatus(row, today),
      })),
    };
  }

  /**
   * A parcela com o que o pagamento precisa, pelo id ou pelo lançamento e o número, travada até o fim da
   * transação, ou nula quando ela não existe: a trava segura outro pagamento da mesma parcela até este ser
   * gravado (regra 6.5).
   */
  async paymentTargetOf(
    which: { readonly id: string } | { readonly entryId: string; readonly number: number },
  ): Promise<PaymentTarget | null> {
    const where =
      'id' in which
        ? sql`i.id = ${which.id}::uuid`
        : sql`i.entry_id = ${which.entryId}::uuid AND i.number = ${which.number}`;
    const [row] = await this.transactions.client.$queryRaw<PaymentTarget[]>`
      SELECT i.id::text AS id, e.entity_id::text AS "entityId", e.description,
        i.number, (SELECT count(*)::int FROM installment WHERE entry_id = e.id) AS "installmentCount",
        i.amount, i.reconciled_amount AS "reconciledAmount", i.direction::text AS direction
      FROM installment i JOIN entry e ON e.id = i.entry_id
      WHERE ${where}
      FOR UPDATE OF i`;
    return row ?? null;
  }

  /**
   * Soma à soma conciliada da parcela o valor dado, negativo no pagamento desfeito, com a auditoria, para a
   * Conciliação, na transação dela (LLD, seção 4.8).
   */
  async addReconciledAmount(installmentId: string, delta: Decimal): Promise<void> {
    const client = this.transactions.client;
    const before = await client.installment.findUniqueOrThrow({
      where: { id: installmentId },
      include: { entry: true },
    });
    const { entry, ...installment } = before;
    const after = await client.installment.update({
      where: { id: installmentId },
      data: { reconciledAmount: { increment: delta }, updatedAt: this.clock.now() },
    });
    await this.audit.record({
      action: 'update',
      tableName: 'installment',
      recordId: installmentId,
      entityId: entry.entityId,
      before: installment,
      after,
    });
  }

  /**
   * As parcelas do lançamento, pelo número, só com o id e o número, quando o usuário tem `view` na entidade
   * dona, ou a recusa: 404 ou 403. A Conciliação as usa para os pagamentos de um lançamento.
   */
  async installmentNumbersOf(entryId: string): Promise<{ readonly id: string; readonly number: number }[]> {
    const entry = await this.readWithLevel(entryId);
    return this.transactions.client.installment.findMany({
      where: { entryId: entry.id },
      select: { id: true, number: true },
      orderBy: { number: 'asc' },
    });
  }

  /** O lançamento do id, quando o usuário tem `view` na entidade dona, ou a recusa: 404 ou 403. */
  private async readWithLevel(id: string): Promise<EntryRow> {
    const row = await this.read(id);
    await requireEntityLevel(row.entityId, 'view');
    return row;
  }

  /** O lançamento do id, com os nomes da categoria e do pai e o número de parcelas, ou a recusa 404. */
  private async read(id: string): Promise<EntryRow> {
    const [row] = await this.transactions.client.$queryRaw<EntryRow[]>`${ENTRY_SELECT} WHERE e.id = ${id}::uuid`;
    if (!row) throw notFound();
    return row;
  }
}
