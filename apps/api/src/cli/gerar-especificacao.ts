import 'reflect-metadata';

import { readFile, writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { configurarApp } from '../app.js';
import { AppModule } from '../app.module.js';

// Gera a especificação OpenAPI a partir dos controladores, sem abrir a porta nem conectar ao banco.
//
//   node .openapi/cli/gerar-especificacao.js <arquivo>              grava a especificação no arquivo
//   node .openapi/cli/gerar-especificacao.js --conferir <arquivo>   sai com 1 quando o arquivo difere
//
// Quem o chama são os scripts openapi:gerar e openapi:conferir do package.json da api.

const USO = 'Uso: gerar-especificacao [--conferir] <arquivo>';

// A app é montada sem nunca abrir conexão, mas a configuração exige a do banco. Sem ela, como num
// contêiner sem o ambiente da api, vale um endereço que não é usado.
process.env.DATABASE_URL ??= 'postgresql://sem-banco/gerar-especificacao';

async function gerar(): Promise<string> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configurarApp(app);
  const config = new DocumentBuilder()
    .setTitle('finance')
    .setDescription('A api do finance. O contrato das rotas: LLD, seção 5.')
    .setVersion('1')
    .build();
  const documento = SwaggerModule.createDocument(app, config);
  await app.close();
  return `${JSON.stringify(documento, null, 2)}\n`;
}

async function lerSeExiste(arquivo: string): Promise<string | null> {
  try {
    return await readFile(arquivo, 'utf8');
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const conferir = args[0] === '--conferir';
const arquivo = conferir ? args[1] : args[0];
if (!arquivo || args.length !== (conferir ? 2 : 1)) {
  console.error(USO);
  process.exit(2);
}

const gerada = await gerar();
if (!conferir) {
  await writeFile(arquivo, gerada);
  console.log(`Especificação gravada em ${arquivo}.`);
} else if ((await lerSeExiste(arquivo)) === gerada) {
  console.log(`A cópia da especificação em ${arquivo} está igual à gerada dos controladores.`);
} else {
  console.error(
    `A cópia da especificação em ${arquivo} difere da gerada dos controladores: uma rota mudou sem a cópia ser gerada de novo.`,
  );
  console.error(
    'Como corrigir: gere a cópia com `docker compose -f compose.dev.yaml exec api pnpm openapi:gerar`, confira a mudança no diff e faça o commit dela.',
  );
  process.exit(1);
}
