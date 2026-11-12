import type { Server } from 'node:http';
import { createServer, type Socket } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { configurarApp } from '../src/app.js';
import { AppModule } from '../src/app.module.js';
import { CONFIGURACAO, lerConfiguracao } from '../src/comum/index.js';

/**
 * Um banco que aceita a conexão e nunca responde, numa porta livre de 127.0.0.1. Devolve o endereço e
 * como fechá-lo.
 */
async function bancoMudo(): Promise<{ url: string; fechar: () => Promise<void> }> {
  const conexoes = new Set<Socket>();
  const servidor = createServer((socket) => {
    conexoes.add(socket);
  });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const endereco = servidor.address();
  if (endereco === null || typeof endereco === 'string') throw new Error('O banco mudo não abriu uma porta TCP.');
  return {
    url: `postgresql://finance:finance@127.0.0.1:${String(endereco.port)}/finance`,
    fechar: () =>
      new Promise((fechado) => {
        for (const socket of conexoes) socket.destroy();
        servidor.close(() => {
          fechado();
        });
      }),
  };
}

/** A api inteira, com a conexão do banco trocada pela que o teste passa. */
async function montarApp(databaseUrl: string): Promise<INestApplication<Server>> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIGURACAO)
    .useValue({ ...lerConfiguracao(process.env), databaseUrl })
    .compile();
  const app = modulo.createNestApplication<INestApplication<Server>>();
  configurarApp(app);
  await app.init();
  return app;
}

describe('GET /v1/saude', () => {
  let app: INestApplication<Server> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('responde 200 com o banco conectado', { tags: ['@KAN-7-CA1'] }, async () => {
    app = await montarApp(process.env.DATABASE_URL ?? '');

    const resposta = await request(app.getHttpServer()).get('/v1/saude');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ banco: 'conectado' });
  });

  it('responde 503 sem o banco', { tags: ['@KAN-7-CA1'] }, async () => {
    // Uma porta em que nada escuta: a conexão é recusada, como num banco fora do ar.
    app = await montarApp('postgresql://finance:finance@127.0.0.1:1/finance');

    const resposta = await request(app.getHttpServer()).get('/v1/saude');

    expect(resposta.status).toBe(503);
    // O corpo é só o estado: nada da mensagem do driver chega ao cliente.
    expect(resposta.body).toEqual({ banco: 'fora_do_ar' });
  });

  it('responde 503 quando o banco não responde', { tags: ['@KAN-7-CA1'], timeout: 15_000 }, async () => {
    // O banco aceita a conexão e fica calado: só o prazo de conexão do driver encerra a espera.
    const banco = await bancoMudo();
    try {
      app = await montarApp(banco.url);

      const resposta = await request(app.getHttpServer()).get('/v1/saude');

      expect(resposta.status).toBe(503);
      expect(resposta.body).toEqual({ banco: 'fora_do_ar' });
    } finally {
      await app?.close();
      app = undefined;
      await banco.fechar();
    }
  });
});
