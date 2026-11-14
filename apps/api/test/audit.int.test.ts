import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService, runInRequestContext } from '../src/common/index.js';
import { type AuditEntry, AuditService } from '../src/modules/audit/index.js';
import {
  AUDIT_PROBE_TABLE,
  AuditProbeModule,
  PROBE_USER_HEADER,
  type ProbeResult,
} from './support/audit-probe.module.js';

/** O código do PostgreSQL para a falta de permissão. */
const INSUFFICIENT_PRIVILEGE = '42501';

/** O código do PostgreSQL com que a consulta falhou, ou null se ela passou. */
async function sqlStateOf(query: Promise<unknown>): Promise<string | null> {
  try {
    await query;
    return null;
  } catch (error) {
    // O Prisma guarda o erro do driver em meta.driverAdapterError.cause.
    const cause = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } }).meta
      ?.driverAdapterError?.cause;
    if (!cause?.originalCode) throw error;
    return cause.originalCode;
  }
}

describe('Auditoria', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testingModule = await Test.createTestingModule({ imports: [AppModule, AuditProbeModule] }).compile();
    app = testingModule.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Os registros de auditoria de um registro, do mais antigo ao mais novo. */
  function auditOf(recordId: string) {
    return prisma.auditLog.findMany({ where: { tableName: AUDIT_PROBE_TABLE, recordId }, orderBy: { id: 'asc' } });
  }

  it('grava a auditoria de cada operação do comando', { tags: ['@KAN-8-CA1'] }, async () => {
    const id = randomUUID();
    const userId = randomUUID();
    const entityId = randomUUID();
    const server = request(app.getHttpServer());

    const created = await server
      .post(`/v1/audit-probe/${id}`)
      .set(PROBE_USER_HEADER, userId)
      .query({ name: 'Mercado', entityId })
      .expect(201);
    const updated = await server
      .patch(`/v1/audit-probe/${id}`)
      .set(PROBE_USER_HEADER, userId)
      .query({ name: 'Feira', entityId })
      .expect(200);
    const deleted = await server
      .delete(`/v1/audit-probe/${id}`)
      .set(PROBE_USER_HEADER, userId)
      .query({ entityId })
      .expect(200);

    const transactionAt = (response: { body: ProbeResult }) => new Date(response.body.transactionAt);
    const common = { userId, tableName: AUDIT_PROBE_TABLE, recordId: id, entityId };
    expect(await auditOf(id)).toMatchObject([
      {
        ...common,
        action: 'create',
        occurredAt: transactionAt(created),
        before: null,
        after: { id, name: 'Mercado' },
      },
      {
        ...common,
        action: 'update',
        occurredAt: transactionAt(updated),
        before: { id, name: 'Mercado' },
        after: { id, name: 'Feira' },
      },
      {
        ...common,
        action: 'delete',
        occurredAt: transactionAt(deleted),
        before: { id, name: 'Feira' },
        after: null,
      },
    ]);
  });

  it('uma falha no comando desfaz a mudança e a auditoria', { tags: ['@KAN-8-CA2'] }, async () => {
    const id = randomUUID();
    const server = request(app.getHttpServer());
    await server.post(`/v1/audit-probe/${id}`).query({ name: 'Mercado' }).expect(201);

    await server.patch(`/v1/audit-probe/${id}`).query({ name: 'Feira', fail: 'true' }).expect(500);

    const current = await server.get(`/v1/audit-probe/${id}`).expect(200);
    expect(current.body).toEqual({ id, name: 'Mercado' });
    expect((await auditOf(id)).map((entry) => entry.action)).toEqual(['create']);
  });

  it('recusa gravar a auditoria fora de uma transação', { tags: ['@KAN-8-CA2'] }, async () => {
    const audit = app.get(AuditService);
    const recordId = randomUUID();
    const entry: AuditEntry = {
      action: 'create',
      tableName: AUDIT_PROBE_TABLE,
      recordId,
      entityId: null,
      before: null,
      after: { id: recordId, name: 'Mercado' },
    };
    const refusal = /dentro da transação/;

    // Fora de qualquer requisição, como um comando que esqueceu o contexto.
    await expect(audit.record(entry)).rejects.toThrow(refusal);
    // Numa requisição, sem a transação aberta.
    await expect(
      runInRequestContext({ requestId: randomUUID(), userId: null, entityLevels: null, transaction: null }, () =>
        audit.record(entry),
      ),
    ).rejects.toThrow(refusal);
    expect(await auditOf(recordId)).toEqual([]);
  });

  it('o papel da aplicação não altera nem apaga a auditoria', { tags: ['@KAN-8-CA3'] }, async () => {
    const id = randomUUID();
    await request(app.getHttpServer()).post(`/v1/audit-probe/${id}`).query({ name: 'Mercado' }).expect(201);
    const recorded = await auditOf(id);
    expect(recorded).toHaveLength(1);

    // A conexão da app é a do papel finance_app (DATABASE_URL_TEST), como a api em produção.
    const attempts = [
      prisma.$executeRaw`UPDATE audit_log SET table_name = 'outra' WHERE record_id = ${id}::uuid`,
      prisma.$executeRaw`DELETE FROM audit_log WHERE record_id = ${id}::uuid`,
      prisma.$executeRaw`TRUNCATE audit_log`,
    ];
    for (const attempt of attempts) {
      expect(await sqlStateOf(attempt)).toBe(INSUFFICIENT_PRIVILEGE);
    }
    expect(await auditOf(id)).toEqual(recorded);
  });

  it('grava o identificador da requisição recebido', { tags: ['@KAN-8-CA5'] }, async () => {
    const id = randomUUID();
    const requestId = randomUUID();

    await request(app.getHttpServer())
      .post(`/v1/audit-probe/${id}`)
      .set('X-Request-Id', requestId)
      .query({ name: 'Mercado' })
      .expect(201);

    expect((await auditOf(id)).map((entry) => entry.requestId)).toEqual([requestId]);
  });

  it('gera o identificador quando ele falta ou é inválido', { tags: ['@KAN-8-CA5'] }, async () => {
    const server = request(app.getHttpServer());
    const withoutHeader = randomUUID();
    const withInvalidHeader = randomUUID();
    const invalid = 'nao-e-um-uuid';

    await server.post(`/v1/audit-probe/${withoutHeader}`).query({ name: 'Mercado' }).expect(201);
    await server
      .post(`/v1/audit-probe/${withInvalidHeader}`)
      .set('X-Request-Id', invalid)
      .query({ name: 'Mercado' })
      .expect(201);

    const [generated] = await auditOf(withoutHeader);
    const [replaced] = await auditOf(withInvalidHeader);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(generated?.requestId).toMatch(uuid);
    expect(replaced?.requestId).toMatch(uuid);
    expect(replaced?.requestId).not.toBe(invalid);
  });
});
