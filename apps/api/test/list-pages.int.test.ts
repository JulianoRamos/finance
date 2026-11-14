import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { authedRequest, buildTestApp, newSession, TestClock, uniquePrefix } from './support/app.js';

/** As rotas das listas paginadas. */
const LISTS = ['/v1/entities', '/v1/financial-groups'] as const;

describe('Listas paginadas', () => {
  const clock = new TestClock();
  let app: INestApplication<Server>;

  beforeAll(async () => {
    app = await buildTestApp(clock);
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    'recusa a página e o tamanho fora dos limites e devolve vazia a página depois da última',
    { tags: ['@KAN-19-CA3'] },
    async () => {
      const token = await newSession(app);
      const refusals = [
        { query: { page: '0' }, field: 'page' },
        { query: { pageSize: '0' }, field: 'pageSize' },
        { query: { pageSize: '101' }, field: 'pageSize' },
      ];

      for (const url of LISTS) {
        for (const { query, field } of refusals) {
          const response = await authedRequest(app, token, 'get', url).query(query).expect(400);
          expect(response.body, `${url} ${JSON.stringify(query)}`).toMatchObject({
            code: 'INVALID_INPUT',
            fields: { [field]: expect.any(String) as string },
          });
        }
      }

      const prefix = uniquePrefix();
      for (const first of ['Ana', 'Bia', 'Carla']) {
        await authedRequest(app, token, 'post', '/v1/entities')
          .send({ type: 'individual', name: `${first} ${prefix}` })
          .expect(201);
      }
      const after = await authedRequest(app, token, 'get', '/v1/entities')
        .query({ q: prefix, page: '2', pageSize: '10' })
        .expect(200);

      expect(after.body).toEqual({ items: [], total: 3, page: 2, pageSize: 10 });
    },
  );

  it('devolve vazia a maior página que a validação aceita', async () => {
    const token = await newSession(app);

    for (const url of LISTS) {
      const response = await authedRequest(app, token, 'get', url)
        .query({ q: uniquePrefix(), page: String(Number.MAX_SAFE_INTEGER), pageSize: '100' })
        .expect(200);
      expect(response.body, url).toEqual({ items: [], total: 0, page: Number.MAX_SAFE_INTEGER, pageSize: 100 });
    }
  });
});
