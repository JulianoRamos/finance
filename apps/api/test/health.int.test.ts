import type { Server } from 'node:http';
import { createServer, type Socket } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { configureApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { CONFIG, readConfig } from '../src/common/index.js';

/**
 * Um banco que aceita a conexão e nunca responde, numa porta livre de 127.0.0.1. Devolve o endereço e
 * como fechá-lo.
 */
async function silentDatabase(): Promise<{ url: string; close: () => Promise<void> }> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('O banco mudo não abriu uma porta TCP.');
  return {
    url: `postgresql://finance:finance@127.0.0.1:${String(address.port)}/finance`,
    close: () =>
      new Promise((closed) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => {
          closed();
        });
      }),
  };
}

/** A api inteira, com a conexão do banco trocada pela que o teste passa. */
async function buildApp(databaseUrl: string): Promise<INestApplication<Server>> {
  const testingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG)
    .useValue({ ...readConfig(process.env), databaseUrl })
    .compile();
  const app = testingModule.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('GET /v1/health', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('responde 200 com o banco conectado', { tags: ['@KAN-7-CA1'] }, async () => {
    app = await buildApp(process.env.DATABASE_URL ?? '');

    const response = await request(app.getHttpServer()).get('/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ database: 'connected' });
  });

  it('responde 503 sem o banco', { tags: ['@KAN-7-CA1'] }, async () => {
    // Uma porta em que nada escuta: a conexão é recusada, como num banco fora do ar.
    app = await buildApp('postgresql://finance:finance@127.0.0.1:1/finance');

    const response = await request(app.getHttpServer()).get('/v1/health');

    expect(response.status).toBe(503);
    // O corpo é só o estado: nada da mensagem do driver chega ao cliente.
    expect(response.body).toEqual({ database: 'down' });
  });

  it('responde 503 quando o banco não responde', { tags: ['@KAN-7-CA1'], timeout: 15_000 }, async () => {
    // O banco aceita a conexão e fica calado: só o prazo de conexão do driver encerra a espera.
    const database = await silentDatabase();
    try {
      app = await buildApp(database.url);

      const response = await request(app.getHttpServer()).get('/v1/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ database: 'down' });
    } finally {
      await app?.close();
      app = undefined;
      await database.close();
    }
  });
});
