import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import {
  apiError,
  type Clock,
  CLOCK,
  type Decimal,
  type EntityType,
  formatCalendarDate,
  NAME_COLLATION,
  omit,
  type PageRequest,
  parseCalendarDate,
  readPage,
  sql,
  TransactionService,
} from '../../common/index.js';
import { AuditService } from '../audit/index.js';
import {
  END_BEFORE_START,
  type EquityStake,
  type EquityStakeEnd,
  type EquityStakePage,
  type NewEquityStake,
} from './equity-stakes.dto.js';

/** O que a leitura da participação traz do sócio. */
const WITH_HOLDER = { holder: { select: { id: true, type: true, name: true, active: true } } } as const;

/** A participação como o Prisma a lê, com o sócio. */
interface StakeRow {
  readonly id: string;
  readonly fraction: Decimal;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly version: number;
  readonly holder: { readonly id: string; readonly type: EntityType; readonly name: string; readonly active: boolean };
}

/** A participação como a rota a devolve: a fração com 8 casas e as datas como `AAAA-MM-DD`. */
function toEquityStake(row: StakeRow): EquityStake {
  return {
    id: row.id,
    holder: { ...row.holder },
    fraction: row.fraction.toFixed(8),
    startDate: formatCalendarDate(row.startDate),
    endDate: row.endDate === null ? null : formatCalendarDate(row.endDate),
    version: row.version,
  };
}

/**
 * A chave da trava de transação única das participações (`pg_advisory_xact_lock`): o registro confere a
 * soma e o ciclo sob ela, para dois registros ao mesmo tempo não passarem juntos (regra 6.2).
 */
const EQUITY_STAKE_LOCK = sql`hashtext('equity_stake')`;

/** A recusa de um pedido que a regra da participação não aceita (regra 6.2). */
function refusal(code: string, message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
}

/** A recusa da participação que não existe, ou não é da empresa do caminho. */
function stakeNotFound() {
  return apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Esta participação não existe nesta empresa.');
}

/** A recusa da versão que não é a atual (regra 6.20). */
function versionConflict() {
  return apiError(
    HttpStatus.CONFLICT,
    'VERSION_CONFLICT',
    'Esta participação mudou desde que você a abriu. Recarregue para ver os dados atuais.',
  );
}

/** A data já validada pelo DTO, como o `Date` que o Prisma grava na coluna `date`. */
function dateOf(text: string): Date {
  const date = parseCalendarDate(text);
  if (!date) throw new Error(`A data ${text} chegou ao serviço sem ser validada.`);
  return date;
}

/**
 * O dono da tabela `equity_stake`: a lista das participações numa empresa, o registro e o encerramento,
 * com a auditoria (regra 6.2).
 */
@Injectable()
export class EquityStakesService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * A página das participações na empresa, encerradas ou não: as sem fim primeiro, depois pelo último
   * dia e pelo início, dos mais recentes aos mais antigos, e pelo nome do sócio.
   */
  async list(companyId: string, page: PageRequest): Promise<EquityStakePage> {
    const client = this.transactions.client;
    return readPage(
      client,
      sql`SELECT stake.id, stake.end_date, stake.start_date, holder.name FROM equity_stake stake
        JOIN entity holder ON holder.id = stake.holder_id
        WHERE stake.company_id = ${companyId}::uuid`,
      sql`end_date DESC NULLS FIRST, start_date DESC, name ${NAME_COLLATION}`,
      page,
      async (ids) =>
        (await client.equityStake.findMany({ where: { id: { in: ids } }, include: WITH_HOLDER })).map(toEquityStake),
    );
  }

  /**
   * Registra a participação do sócio na empresa, na versão 1, com a auditoria. O sócio é uma entidade
   * ativa que o usuário vê (`visibleIds`), e não a própria empresa (regra 6.2).
   */
  create(companyId: string, input: NewEquityStake, visibleIds: readonly string[]): Promise<EquityStake> {
    return this.transactions.run(async () => {
      const company = await this.transactions.client.entity.findUniqueOrThrow({ where: { id: companyId } });
      if (company.type !== 'company') {
        throw refusal('EQUITY_STAKE_REQUIRES_COMPANY', 'Só uma pessoa jurídica recebe participações.');
      }
      const holderId = input.holderId.toLowerCase();
      if (holderId === company.id) throw refusal('EQUITY_STAKE_SELF', 'Uma empresa não participa de si mesma.');
      await this.readHolder(holderId, visibleIds);
      const startDate = dateOf(input.startDate);
      const endDate = input.endDate ? dateOf(input.endDate) : null;
      await this.transactions.client.$executeRaw`SELECT pg_advisory_xact_lock(${EQUITY_STAKE_LOCK})`;
      await this.checkSum(company.id, input.fraction, input.startDate, input.endDate ?? null);
      await this.checkCycle(company.id, holderId);
      const now = this.clock.now();
      const created = await this.transactions.client.equityStake.create({
        data: {
          companyId: company.id,
          holderId,
          fraction: input.fraction,
          startDate,
          endDate,
          createdAt: now,
          updatedAt: now,
        },
        include: WITH_HOLDER,
      });
      await this.audit.record({
        action: 'create',
        tableName: 'equity_stake',
        recordId: created.id,
        entityId: company.id,
        before: null,
        after: omit(created, 'holder'),
      });
      return toEquityStake(created);
    });
  }

  /**
   * Encerra a participação sem fim da empresa com o último dia, com a versão lida, na versão seguinte.
   * Encerrar nunca aumenta a soma vigente nem cria ciclo, então não a confere de novo nem toma a trava
   * das participações (regra 6.2): um registro ao mesmo tempo, que leu a participação ainda sem fim, só
   * contou uma soma maior que a real. Uma alteração que possa aumentar a soma, como mudar a fração ou
   * reabrir, precisa da trava.
   */
  end(companyId: string, stakeId: string, input: EquityStakeEnd): Promise<EquityStake> {
    return this.transactions.run(async () => {
      const client = this.transactions.client;
      await client.$queryRaw`SELECT 1 FROM equity_stake WHERE id = ${stakeId}::uuid FOR UPDATE`;
      const before = await client.equityStake.findFirst({ where: { id: stakeId, companyId } });
      if (!before) throw stakeNotFound();
      if (before.endDate !== null) {
        throw refusal('EQUITY_STAKE_ENDED', 'Esta participação já foi encerrada.');
      }
      if (before.version !== input.version) throw versionConflict();
      const endDate = dateOf(input.endDate);
      if (endDate < before.startDate) {
        throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Confira os campos informados.', {
          endDate: END_BEFORE_START,
        });
      }
      const after = await client.equityStake.update({
        where: { id: stakeId },
        data: { endDate, updatedAt: this.clock.now(), version: { increment: 1 } },
        include: WITH_HOLDER,
      });
      await this.audit.record({
        action: 'update',
        tableName: 'equity_stake',
        recordId: stakeId,
        entityId: before.companyId,
        before,
        after: omit(after, 'holder'),
      });
      return toEquityStake(after);
    });
  }

  /**
   * Confere o sócio: uma entidade que o usuário vê, ou a recusa sem dizer se ela existe, e ativa. FOR
   * SHARE: uma desativação ao mesmo tempo espera esta transação, ou esta lê o sócio já desativado.
   */
  private async readHolder(holderId: string, visibleIds: readonly string[]): Promise<void> {
    const [holder] = await this.transactions.client.$queryRaw<{ active: boolean }[]>`
      SELECT active FROM entity WHERE id = ${holderId}::uuid FOR SHARE`;
    if (!holder || !visibleIds.includes(holderId)) {
      throw refusal('ENTITY_NOT_FOUND', 'O sócio escolhido não existe.');
    }
    if (!holder.active) {
      throw refusal('INACTIVE_ENTITY', 'Um sócio desativado não recebe participação. Reative-o antes.');
    }
  }

  /**
   * Confere que, em nenhum dia do período novo, a soma das participações vigentes na empresa com a nova
   * passa de 1 (regra 6.2). A maior soma num período cai no primeiro dia dele ou no início de uma das
   * participações que se sobrepõem a ele, então só esses dias são somados.
   */
  private async checkSum(
    companyId: string,
    fraction: string,
    startDate: string,
    endDate: string | null,
  ): Promise<void> {
    // As datas vão como o texto `AAAA-MM-DD`: um `Date` chegaria como instante, e o `::date` o leria no
    // fuso da sessão do banco, que pode mudar o dia.
    const [row] = await this.transactions.client.$queryRaw<{ peak: Decimal | null }[]>`
      WITH overlapping AS (
        SELECT fraction, start_date, end_date FROM equity_stake
        WHERE company_id = ${companyId}::uuid
          AND start_date <= COALESCE(${endDate}::date, 'infinity'::date)
          AND (end_date IS NULL OR end_date >= ${startDate}::date)
      ), days AS (
        SELECT ${startDate}::date AS day
        UNION SELECT start_date FROM overlapping WHERE start_date > ${startDate}::date
      )
      SELECT max(total) AS peak FROM (
        SELECT sum(stake.fraction) AS total FROM days
        JOIN overlapping stake ON stake.start_date <= days.day AND (stake.end_date IS NULL OR stake.end_date >= days.day)
        GROUP BY days.day
      ) per_day`;
    if (row?.peak?.plus(fraction).greaterThan(1)) {
      throw refusal(
        'EQUITY_STAKE_OVER_LIMIT',
        'Com esta participação, a soma das vigentes na empresa passaria de 100% em algum dia do período.',
      );
    }
  }

  /**
   * Confere que a participação não fecha um ciclo: a empresa não pode já ser sócia, direta ou
   * indiretamente, do sócio novo (regra 6.17). A busca anda dos sócios do sócio novo para cima e conta
   * todas as participações, encerradas ou não, para o patrimônio de uma data passada também não ter ciclo.
   */
  private async checkCycle(companyId: string, holderId: string): Promise<void> {
    const [row] = await this.transactions.client.$queryRaw<{ cycle: boolean }[]>`
      WITH RECURSIVE owners (id) AS (
        SELECT holder_id FROM equity_stake WHERE company_id = ${holderId}::uuid
        UNION
        SELECT stake.holder_id FROM equity_stake stake JOIN owners ON stake.company_id = owners.id
      )
      SELECT EXISTS (SELECT 1 FROM owners WHERE id = ${companyId}::uuid) AS cycle`;
    if (row?.cycle) {
      throw refusal(
        'EQUITY_STAKE_CYCLE',
        'Esta participação fecharia um ciclo: a empresa já participa, direta ou indiretamente, deste sócio.',
      );
    }
  }
}
