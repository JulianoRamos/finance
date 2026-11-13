import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/common/index.js';
import { databaseClient, migrateDeploy, requiredEnv } from './support/database.js';

/** A Visão Familiar como o banco a guarda, com a contagem dos membros. */
interface FamilyViewRow {
  readonly id: string;
  readonly name: string;
  readonly members: number;
}

// O finance_test já tem a Visão Familiar, com os membros dos outros testes: o critério é provado num
// banco próprio, criado e apagado pelo papel dono, que é o superusuário do PostgreSQL de desenvolvimento.
describe('Visão Familiar', () => {
  const database = `finance_family_view_${randomUUID().replaceAll('-', '')}`;
  const databaseUrl = (() => {
    const url = new URL(requiredEnv('DATABASE_OWNER_URL_TEST'));
    url.pathname = `/${database}`;
    return url.toString();
  })();
  const admin = databaseClient(requiredEnv('DATABASE_OWNER_URL_TEST'));
  let client: PrismaService;

  /** Os grupos com is_family_view verdadeiro, com a contagem dos membros de cada um. */
  function familyViews(): Promise<FamilyViewRow[]> {
    return client.$queryRawUnsafe<FamilyViewRow[]>(
      `SELECT g.id::text AS id, g.name, count(m.id)::int AS members
         FROM financial_group g LEFT JOIN financial_group_member m ON m.financial_group_id = g.id
        WHERE g.is_family_view
        GROUP BY g.id`,
    );
  }

  beforeAll(async () => {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    client = databaseClient(databaseUrl);
  });

  afterAll(async () => {
    await client.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  });

  it(
    'a Visão Familiar nasce vazia na primeira migração e não é criada de novo',
    { tags: ['@KAN-12-CA1'], timeout: 60_000 },
    async () => {
      migrateDeploy(databaseUrl, 'pipe');
      const first = await familyViews();

      migrateDeploy(databaseUrl, 'pipe');
      const second = await familyViews();
      const duplicate = client.$executeRawUnsafe(
        `INSERT INTO financial_group (name, is_family_view, created_at, updated_at)
         VALUES ('Outra Visão Familiar', true, now(), now())`,
      );

      expect(first).toEqual([{ id: expect.any(String) as string, name: 'Visão Familiar', members: 0 }]);
      expect(second).toEqual(first);
      await expect(duplicate).rejects.toThrow(/financial_group_family_view_key/);
    },
  );
});
