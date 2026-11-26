import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  type Clock,
  CLOCK,
  currentRequestContext,
  type Decimal,
  hasEntityLevel,
  type PageRequest,
  readPage,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AccountsService } from '../accounts/index.js';
import { AuditService } from '../audit/index.js';
import { EntriesService, type Entry, type PaymentTarget } from '../entries/index.js';
import type {
  InstallmentPayment,
  InstallmentPaymentPage,
  NewInstallmentPayment,
  NewPaidEntry,
} from './reconciliation.dto.js';

/** A conciliação como o Prisma a lê. */
interface ReconciliationRow {
  readonly id: string;
  readonly movementId: string;
  readonly installmentId: string;
  readonly amount: Decimal;
}

/**
 * O pedaço do código das recusas da conta do pagamento: no já pago, `PAYMENT_`, para não se confundirem
 * com as da conta das parcelas (`INVALID_PAYMENT_ACCOUNT`, e não `INVALID_ACCOUNT`).
 */
type AccountCodePrefix = '' | 'PAYMENT_';

/** Uma recusa do pagamento por uma regra de negócio (regra 6.5). */
function refused(code: string, message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
}

/** A recusa da falta de `operate` na entidade dona do lançamento (regra 6.1). */
function forbidden() {
  return apiError(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você só pode ver os lançamentos desta entidade, e não registrar pagamentos.',
  );
}

/** A descrição da movimentação do pagamento: a do lançamento e, no parcelado, a parcela. */
function movementDescription(target: PaymentTarget): string {
  return target.installmentCount > 1
    ? `${target.description} (parcela ${String(target.number)} de ${String(target.installmentCount)})`
    : target.description;
}

/**
 * O dono da tabela `reconciliation`: por enquanto, o pagamento das parcelas, a movimentação manual ligada
 * à parcela que ela paga (LLD, seção 4.8, e regra 6.5). Ele chama o Lançamentos, para criar o lançamento e
 * somar o que foi pago na parcela, e as Contas, para a movimentação.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly entries: EntriesService,
    private readonly accounts: AccountsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Registra o lançamento já pago: cria o lançamento, pelo Lançamentos, e paga a primeira parcela dele, a
   * única no à vista, na conta e na data do pagamento, numa transação (regra 6.5).
   */
  createPaidEntry(input: NewPaidEntry): Promise<Entry> {
    return this.transactions.run(async () => {
      const { paymentAccountId, paymentDate, ...entry } = input;
      const created = await this.entries.create(entry);
      const target = await this.entries.paymentTargetOf({ entryId: created.id, number: 1 });
      if (!target) throw new Error('O lançamento acabou de nascer sem a primeira parcela.');
      await this.pay(target, paymentAccountId.toLowerCase(), paymentDate, 'PAYMENT_');
      return created;
    });
  }

  /**
   * Paga a parcela em aberto pelo valor em aberto dela, na conta e na data dadas, quando o usuário tem
   * `operate` na entidade dona do lançamento.
   */
  payInstallment(input: NewInstallmentPayment): Promise<InstallmentPayment> {
    return this.transactions.run(async () => {
      const target = await this.entries.paymentTargetOf({ id: input.installmentId.toLowerCase() });
      if (!target) throw refused('INVALID_INSTALLMENT', 'A parcela escolhida não existe.');
      if (!(await hasEntityLevel(target.entityId, 'operate'))) throw forbidden();
      return this.pay(target, input.accountId.toLowerCase(), input.date, '');
    });
  }

  /**
   * Desfaz o pagamento, quando o usuário tem `operate` na entidade dona do lançamento: exclui a conciliação
   * e a movimentação manual que o pagamento criou, e tira o valor dela da soma conciliada da parcela.
   */
  undoPayment(id: string): Promise<void> {
    return this.transactions.run(async () => {
      const client = this.transactions.client;
      // A trava segura outro desfazer do mesmo pagamento até este ser gravado.
      await client.$queryRaw`SELECT 1 FROM reconciliation WHERE id = ${id}::uuid FOR UPDATE`;
      const reconciliation = await client.reconciliation.findUnique({ where: { id } });
      if (!reconciliation) throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Este pagamento não existe.');
      const target = await this.entries.paymentTargetOf({ id: reconciliation.installmentId });
      if (!target) throw new Error('A conciliação aponta para uma parcela que não existe.');
      if (!(await hasEntityLevel(target.entityId, 'operate'))) throw forbidden();
      await client.reconciliation.delete({ where: { id } });
      await this.audit.record({
        action: 'delete',
        tableName: 'reconciliation',
        recordId: id,
        entityId: target.entityId,
        before: reconciliation,
        after: null,
      });
      await this.accounts.deleteManualMovement(reconciliation.movementId);
      await this.entries.addReconciledAmount(target.id, reconciliation.amount.negated());
    });
  }

  /**
   * A página dos pagamentos das parcelas do lançamento, pelo número da parcela, quando o usuário tem `view`
   * na entidade dona, ou a recusa do Lançamentos: 404 ou 403.
   */
  async listPayments(entryId: string, page: PageRequest): Promise<InstallmentPaymentPage> {
    const installments = await this.entries.installmentNumbersOf(entryId);
    const numbers = new Map(installments.map((installment) => [installment.id, installment.number]));
    const ids = installments.map((installment) => installment.id);
    const client = this.transactions.client;
    return readPage(
      client,
      sql`SELECT id, array_position(${ids}::uuid[], installment_id) AS position, created_at
        FROM reconciliation WHERE installment_id = ANY(${ids}::uuid[])`,
      sql`position, created_at`,
      page,
      async (pageIds) => {
        const rows = await client.reconciliation.findMany({ where: { id: { in: pageIds } } });
        return this.toPayments(rows, numbers);
      },
    );
  }

  /**
   * Paga a parcela travada: confere a conta do pagamento, cria a movimentação manual pelo valor em aberto,
   * no sentido da parcela, e a conciliação, e soma o valor na parcela, com a auditoria de cada um.
   */
  private async pay(
    target: PaymentTarget,
    accountId: string,
    date: string,
    prefix: AccountCodePrefix,
  ): Promise<InstallmentPayment> {
    const open = target.amount.minus(target.reconciledAmount);
    if (!open.greaterThan(0)) {
      throw refused(
        'INSTALLMENT_ALREADY_SETTLED',
        'Esta parcela já está paga. Para pagá-la de novo, desfaça antes o pagamento.',
      );
    }
    const account = (await this.accounts.summariesOf([accountId], { lock: true })).get(accountId);
    if (account?.entityId !== target.entityId) {
      throw refused(`INVALID_${prefix}ACCOUNT`, 'A conta do pagamento não existe ou é de outra entidade.');
    }
    if (!account.active) {
      throw refused(`INACTIVE_${prefix}ACCOUNT`, 'A conta do pagamento está desativada. Reative-a ou escolha outra.');
    }
    const movement = await this.accounts.createMovement(accountId, {
      direction: target.direction,
      date,
      amount: open.toFixed(2),
      description: movementDescription(target),
    });
    const userId = currentRequestContext()?.userId;
    if (!userId) throw new Error('O pagamento chegou ao serviço sem o usuário da requisição.');
    const now = this.clock.now();
    const created = await this.transactions.client.reconciliation.create({
      data: {
        movementId: movement.id,
        installmentId: target.id,
        amount: open,
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      },
    });
    await this.audit.record({
      action: 'create',
      tableName: 'reconciliation',
      recordId: created.id,
      entityId: target.entityId,
      before: null,
      after: created,
    });
    await this.entries.addReconciledAmount(target.id, open);
    return {
      id: created.id,
      installmentId: target.id,
      installmentNumber: target.number,
      movementId: movement.id,
      accountId,
      accountName: account.name,
      date,
      amount: open.toFixed(2),
    };
  }

  /** Os pagamentos como a rota os devolve, com a data da movimentação e o nome da conta, pelas Contas. */
  private async toPayments(
    rows: readonly ReconciliationRow[],
    numbers: ReadonlyMap<string, number>,
  ): Promise<InstallmentPayment[]> {
    const movements = await this.accounts.movementSummariesOf(rows.map((row) => row.movementId));
    const accounts = await this.accounts.summariesOf([...new Set([...movements.values()].map((m) => m.accountId))]);
    return rows.map((row) => {
      const movement = movements.get(row.movementId);
      return {
        id: row.id,
        installmentId: row.installmentId,
        installmentNumber: numbers.get(row.installmentId) ?? 0,
        movementId: row.movementId,
        accountId: movement?.accountId ?? '',
        accountName: movement ? (accounts.get(movement.accountId)?.name ?? '') : '',
        date: movement?.date ?? '',
        amount: row.amount.toFixed(2),
      };
    });
  }
}
