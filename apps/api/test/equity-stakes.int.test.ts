import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/common/index.js';
import { authedRequest, buildTestApp, newSession, TestClock, uniqueName } from './support/app.js';

/** O sócio de uma participação, como o contrato o descreve. */
interface EquityStakeHolder {
  readonly id: string;
  readonly type: 'individual' | 'company';
  readonly name: string;
  readonly active: boolean;
}

/** Uma participação societária, como o contrato a descreve. */
interface EquityStake {
  readonly id: string;
  readonly holder: EquityStakeHolder;
  readonly fraction: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly version: number;
}

/** Uma página da lista das participações, como o contrato a descreve. */
interface EquityStakePage {
  readonly items: EquityStake[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Uma entidade, só com o que os testes das participações usam. */
interface Entity {
  readonly id: string;
  readonly type: 'individual' | 'company';
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
}

/** A entidade como sócio de uma participação. */
function asHolder(entity: Entity): EquityStakeHolder {
  return { id: entity.id, type: entity.type, name: entity.name, active: entity.active };
}

describe('Participações societárias', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Um pedido com o token da sessão. */
  function authed(token: string, method: 'get' | 'post' | 'put', url: string) {
    return authedRequest(app, token, method, url);
  }

  /** Cadastra uma entidade ativa e a devolve. */
  async function newEntity(token: string, type: Entity['type'], prefix = 'Participação'): Promise<Entity> {
    const response = await authed(token, 'post', '/v1/entities')
      .send({ type, name: uniqueName(prefix) })
      .expect(201);
    return response.body as Entity;
  }

  /** O pedido de registro de uma participação na empresa. */
  function postStake(token: string, companyId: string, body: Record<string, unknown>) {
    return authed(token, 'post', `/v1/entities/${companyId}/equity-stakes`).send(body);
  }

  /** Registra a participação, que tem de ser aceita, e a devolve. */
  async function newStake(token: string, companyId: string, body: Record<string, unknown>): Promise<EquityStake> {
    return (await postStake(token, companyId, body).expect(201)).body as EquityStake;
  }

  /** O pedido de encerramento da participação. */
  function endStake(token: string, companyId: string, stakeId: string, body: Record<string, unknown>) {
    return authed(token, 'put', `/v1/entities/${companyId}/equity-stakes/${stakeId}/end`).send(body);
  }

  /** A primeira página da lista das participações na empresa. */
  async function listStakes(token: string, companyId: string): Promise<EquityStakePage> {
    return (await authed(token, 'get', `/v1/entities/${companyId}/equity-stakes`).expect(200)).body as EquityStakePage;
  }

  it(
    'o usuário registra a participação de uma entidade numa empresa, com a fração e o período',
    { tags: ['@KAN-15-CA1'] },
    async () => {
      const token = await newSession(app);
      const company = await newEntity(token, 'company');
      const person = await newEntity(token, 'individual');
      const partner = await newEntity(token, 'company');

      const open = await newStake(token, company.id, {
        holderId: person.id,
        fraction: '0.25',
        startDate: '2022-03-01',
      });
      expect(open).toEqual({
        id: expect.any(String) as string,
        holder: asHolder(person),
        fraction: '0.25000000',
        startDate: '2022-03-01',
        endDate: null,
        version: 1,
      });

      const ended = await newStake(token, company.id, {
        holderId: partner.id,
        fraction: '0.125',
        startDate: '2023-01-01',
        endDate: '2024-12-31',
      });
      expect(ended).toMatchObject({
        holder: asHolder(partner),
        fraction: '0.12500000',
        startDate: '2023-01-01',
        endDate: '2024-12-31',
        version: 1,
      });

      const page = await listStakes(token, company.id);
      expect(page.total).toBe(2);
      expect(page.items.map((stake) => stake.id)).toEqual([open.id, ended.id]);

      const valid = { holderId: person.id, fraction: '0.1', startDate: '2025-01-01' };
      const invalid: [Record<string, unknown>, string][] = [
        [{ ...valid, fraction: '0' }, 'fraction'],
        [{ ...valid, fraction: '1.5' }, 'fraction'],
        [{ ...valid, fraction: '0.123456789' }, 'fraction'],
        [{ ...valid, startDate: '01/03/2022' }, 'startDate'],
        [{ ...valid, endDate: '2024-12-31' }, 'endDate'],
      ];
      for (const [body, field] of invalid) {
        const response = await postStake(token, company.id, body).expect(400);
        expect(response.body).toMatchObject({ code: 'INVALID_INPUT' });
        expect(Object.keys((response.body as { fields: Record<string, string> }).fields)).toContain(field);
      }
      expect((await listStakes(token, company.id)).total).toBe(2);
    },
  );

  it(
    'só pessoa jurídica recebe participação, e nenhuma empresa participa de si mesma',
    { tags: ['@KAN-15-CA4'] },
    async () => {
      const token = await newSession(app);
      const company = await newEntity(token, 'company');
      const person = await newEntity(token, 'individual');
      const otherPerson = await newEntity(token, 'individual');
      const inactive = await newEntity(token, 'individual');
      await authed(token, 'put', `/v1/entities/${inactive.id}/active`)
        .send({ active: false, version: inactive.version })
        .expect(200);
      const body = { fraction: '0.1', startDate: '2024-01-01' };

      const refusals: [string, string, string][] = [
        [otherPerson.id, person.id, 'EQUITY_STAKE_REQUIRES_COMPANY'],
        [company.id, company.id, 'EQUITY_STAKE_SELF'],
        [company.id, randomUUID(), 'ENTITY_NOT_FOUND'],
        [company.id, inactive.id, 'INACTIVE_ENTITY'],
      ];
      for (const [companyId, holderId, code] of refusals) {
        const response = await postStake(token, companyId, { ...body, holderId }).expect(422);
        expect(response.body).toMatchObject({ code });
      }
      expect((await listStakes(token, company.id)).total).toBe(0);
      expect((await listStakes(token, otherPerson.id)).total).toBe(0);
    },
  );

  it('uma soma vigente acima de 100% é recusada', { tags: ['@KAN-15-CA2'] }, async () => {
    const token = await newSession(app);
    const company = await newEntity(token, 'company');
    const [first, second, third] = [
      await newEntity(token, 'individual'),
      await newEntity(token, 'individual'),
      await newEntity(token, 'individual'),
    ];
    await newStake(token, company.id, { holderId: first.id, fraction: '0.6', startDate: '2024-01-01' });
    await newStake(token, company.id, { holderId: second.id, fraction: '0.4', startDate: '2024-06-01' });

    const overLimit = [
      { holderId: third.id, fraction: '0.01', startDate: '2025-01-01' },
      // Sobrepõe-se à de 0.6 em janeiro de 2024, antes da de 0.4 começar.
      { holderId: third.id, fraction: '0.5', startDate: '2020-01-01', endDate: '2024-01-31' },
    ];
    for (const body of overLimit) {
      const response = await postStake(token, company.id, body).expect(422);
      expect(response.body).toMatchObject({ code: 'EQUITY_STAKE_OVER_LIMIT' });
    }
    expect((await listStakes(token, company.id)).items.map((stake) => stake.holder.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it(
    'uma participação encerrada deixa de contar na soma vigente depois do último dia',
    { tags: ['@KAN-15-CA7'] },
    async () => {
      const token = await newSession(app);
      const company = await newEntity(token, 'company');
      const [first, second] = [await newEntity(token, 'individual'), await newEntity(token, 'individual')];
      const stake = await newStake(token, company.id, { holderId: first.id, fraction: '1', startDate: '2024-01-01' });

      const ended = await endStake(token, company.id, stake.id, { endDate: '2024-06-30', version: stake.version });
      expect(ended.status).toBe(200);
      expect(ended.body).toMatchObject({ id: stake.id, endDate: '2024-06-30', version: 2 });

      await newStake(token, company.id, { holderId: second.id, fraction: '1', startDate: '2024-07-01' });
      const overlapping = await postStake(token, company.id, {
        holderId: second.id,
        fraction: '1',
        startDate: '2024-06-30',
      }).expect(422);
      expect(overlapping.body).toMatchObject({ code: 'EQUITY_STAKE_OVER_LIMIT' });

      const again = await endStake(token, company.id, stake.id, { endDate: '2024-07-31', version: 2 }).expect(422);
      expect(again.body).toMatchObject({ code: 'EQUITY_STAKE_ENDED' });

      const other = await newEntity(token, 'company');
      const otherStake = await newStake(token, other.id, {
        holderId: first.id,
        fraction: '0.5',
        startDate: '2020-01-01',
      });
      const conflict = await endStake(token, other.id, otherStake.id, { endDate: '2024-01-01', version: 3 }).expect(
        409,
      );
      expect(conflict.body).toMatchObject({ code: 'VERSION_CONFLICT' });
      const beforeStart = await endStake(token, other.id, otherStake.id, { endDate: '2019-12-31', version: 1 }).expect(
        400,
      );
      expect(beforeStart.body).toMatchObject({
        code: 'INVALID_INPUT',
        fields: { endDate: expect.any(String) as string },
      });
      const foreign = await endStake(token, company.id, otherStake.id, { endDate: '2024-01-01', version: 1 }).expect(
        404,
      );
      expect(foreign.body).toMatchObject({ code: 'NOT_FOUND' });
    },
  );
  it('uma participação que fecharia um ciclo é recusada', { tags: ['@KAN-15-CA3'] }, async () => {
    const token = await newSession(app);
    const [a, b, c, d] = [
      await newEntity(token, 'company', 'Empresa A'),
      await newEntity(token, 'company', 'Empresa B'),
      await newEntity(token, 'company', 'Empresa C'),
      await newEntity(token, 'company', 'Empresa D'),
    ];
    const period = { fraction: '0.3', startDate: '2024-01-01' };
    await newStake(token, b.id, { ...period, holderId: a.id });
    const bInC = await newStake(token, c.id, { ...period, holderId: b.id });

    const cycle = await postStake(token, a.id, { ...period, holderId: c.id }).expect(422);
    expect(cycle.body).toMatchObject({ code: 'EQUITY_STAKE_CYCLE' });

    await endStake(token, c.id, bInC.id, { endDate: '2024-06-30', version: bInC.version }).expect(200);
    const afterEnd = await postStake(token, a.id, { ...period, startDate: '2025-01-01', holderId: c.id }).expect(422);
    expect(afterEnd.body).toMatchObject({ code: 'EQUITY_STAKE_CYCLE' });

    await newStake(token, d.id, { ...period, holderId: c.id });
    expect((await listStakes(token, a.id)).total).toBe(0);
  });

  it('as participações ficam na auditoria', { tags: ['@KAN-15-CA6'] }, async () => {
    const token = await newSession(app);
    const company = await newEntity(token, 'company');
    const person = await newEntity(token, 'individual');
    const other = await newEntity(token, 'individual');
    const stake = await newStake(token, company.id, { holderId: person.id, fraction: '0.25', startDate: '2022-03-01' });
    await endStake(token, company.id, stake.id, { endDate: '2026-11-30', version: 1 }).expect(200);
    await postStake(token, company.id, { holderId: other.id, fraction: '0.8', startDate: '2022-01-01' }).expect(422);

    const audit = await app.get(PrismaService).auditLog.findMany({
      where: { tableName: 'equity_stake', entityId: company.id },
      orderBy: { id: 'asc' },
    });
    expect(audit).toMatchObject([
      {
        action: 'create',
        recordId: stake.id,
        before: null,
        after: { holderId: person.id, fraction: '0.25', startDate: '2022-03-01', endDate: null, version: 1 },
      },
      {
        action: 'update',
        recordId: stake.id,
        before: { endDate: null, version: 1 },
        after: { endDate: '2026-11-30', version: 2 },
      },
    ]);
  });
});
