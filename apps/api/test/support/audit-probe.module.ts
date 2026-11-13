import {
  Controller,
  Delete,
  Get,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { NextFunction, Request, Response } from 'express';

import { Public, setCurrentUser, TransactionService } from '../../src/common/index.js';
import { type AuditEntry, AuditModule, AuditService } from '../../src/modules/audit/index.js';

/** O nome da tabela de prova, criada pela preparação da suíte (test/setup-database.ts). */
export const AUDIT_PROBE_TABLE = 'audit_probe';

/** O cabeçalho com que o teste põe um usuário no contexto, sem passar pela autenticação. */
export const PROBE_USER_HEADER = 'probe-user-id';

interface ProbeRow extends Record<string, unknown> {
  id: string;
  name: string;
}

/** O que o comando de prova devolve: o instante da transação em que ele rodou. */
export interface ProbeResult {
  transactionAt: string;
}

/**
 * O comando de prova: altera a tabela de prova e grava a auditoria, como o serviço público de um módulo
 * de domínio vai fazer. Só existe nos testes, porque ainda não há tabela de domínio.
 */
@Injectable()
class AuditProbeService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}

  async find(id: string): Promise<ProbeRow | undefined> {
    const [row] = await this.transactions.client.$queryRaw<ProbeRow[]>`
      SELECT id, name FROM audit_probe WHERE id = ${id}::uuid`;
    return row;
  }

  create(id: string, name: string, entityId: string | null): Promise<ProbeResult> {
    return this.transactions.run(async () => {
      const [after] = await this.transactions.client.$queryRaw<ProbeRow[]>`
        INSERT INTO audit_probe (id, name) VALUES (${id}::uuid, ${name}) RETURNING id, name`;
      await this.recordAudit('create', id, entityId, null, after);
      return this.result();
    });
  }

  update(id: string, name: string, entityId: string | null, fail: boolean): Promise<ProbeResult> {
    return this.transactions.run(async () => {
      const [before] = await this.transactions.client.$queryRaw<ProbeRow[]>`
        SELECT id, name FROM audit_probe WHERE id = ${id}::uuid FOR UPDATE`;
      const [after] = await this.transactions.client.$queryRaw<ProbeRow[]>`
        UPDATE audit_probe SET name = ${name} WHERE id = ${id}::uuid RETURNING id, name`;
      await this.recordAudit('update', id, entityId, before, after);
      if (fail) throw new Error('Falha provocada pelo comando de prova, depois da auditoria.');
      return this.result();
    });
  }

  delete(id: string, entityId: string | null): Promise<ProbeResult> {
    return this.transactions.run(async () => {
      const [before] = await this.transactions.client.$queryRaw<ProbeRow[]>`
        DELETE FROM audit_probe WHERE id = ${id}::uuid RETURNING id, name`;
      await this.recordAudit('delete', id, entityId, before, null);
      return this.result();
    });
  }

  private recordAudit(
    action: AuditEntry['action'],
    id: string,
    entityId: string | null,
    before: ProbeRow | null | undefined,
    after: ProbeRow | null | undefined,
  ): Promise<void> {
    return this.audit.record({
      action,
      tableName: AUDIT_PROBE_TABLE,
      recordId: id,
      entityId,
      before: before ?? null,
      after: after ?? null,
    });
  }

  /** O instante da transação corrente, que o PostgreSQL devolve no now(). */
  private async result(): Promise<ProbeResult> {
    const [row] = await this.transactions.client.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    if (!row) throw new Error('O now() não devolveu linha.');
    return { transactionAt: row.now.toISOString() };
  }
}

/** A rota de prova, que chama o comando de prova como uma rota de domínio chama o serviço dela. */
@Controller('audit-probe')
@Public()
class AuditProbeController {
  constructor(private readonly probe: AuditProbeService) {}

  @Get(':id')
  async find(@Param('id', ParseUUIDPipe) id: string): Promise<ProbeRow> {
    const row = await this.probe.find(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  @Post(':id')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('name') name: string,
    @Query('entityId') entityId: string | undefined,
  ): Promise<ProbeResult> {
    return this.probe.create(id, name, entityId ?? null);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('name') name: string,
    @Query('entityId') entityId: string | undefined,
    @Query('fail') fail: string | undefined,
  ): Promise<ProbeResult> {
    return this.probe.update(id, name, entityId ?? null, fail === 'true');
  }

  @Delete(':id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('entityId') entityId: string | undefined,
  ): Promise<ProbeResult> {
    return this.probe.delete(id, entityId ?? null);
  }
}

/**
 * Põe no contexto o usuário do cabeçalho de prova, como a autenticação faz numa rota protegida.
 */
function probeUserMiddleware(request: Request, _response: Response, next: NextFunction): void {
  setCurrentUser(request.header(PROBE_USER_HEADER) ?? null);
  next();
}

/** O módulo de prova, que os testes montam junto com a app. */
@Module({
  imports: [AuditModule],
  controllers: [AuditProbeController],
  providers: [AuditProbeService],
})
export class AuditProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(probeUserMiddleware).forRoutes(AuditProbeController);
  }
}
