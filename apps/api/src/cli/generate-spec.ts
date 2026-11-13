import 'reflect-metadata';

import { readFile, writeFile } from 'node:fs/promises';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { configureApp } from '../app.js';
import { AppModule } from '../app.module.js';
import { ApiError } from '../common/index.js';

// Gera a especificação OpenAPI a partir dos controladores, sem abrir a porta nem conectar ao banco.
//
//   node .openapi/cli/generate-spec.js <arquivo>           grava a especificação no arquivo
//   node .openapi/cli/generate-spec.js --check <arquivo>   sai com 1 quando o arquivo difere
//
// Quem o chama são os scripts openapi:generate e openapi:check do package.json da api.

const USAGE = 'Uso: generate-spec [--check] <arquivo>';

// A app é montada sem nunca abrir conexão, mas a configuração exige a do banco e o endereço público.
// Sem eles, como num contêiner sem o ambiente da api, valem endereços que não são usados.
process.env.DATABASE_URL ??= 'postgresql://no-database/generate-spec';
process.env.PUBLIC_URL ??= 'http://no-web.invalid';

async function generate(): Promise<string> {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app);
  const config = new DocumentBuilder()
    .setTitle('finance')
    .setDescription('A api do finance. O contrato das rotas: LLD, seção 5.')
    .setVersion('1')
    .addSecurity('session', {
      type: 'http',
      description: 'O token da sessão, que a web lê do cookie e manda em Authorization: Bearer (LLD, seção 5).',
      scheme: 'bearer',
    })
    .build();
  // O corpo de erro comum entra nos esquemas uma vez, e não pelo primeiro controlador que o declara.
  const document = SwaggerModule.createDocument(app, config, { extraModels: [ApiError] });
  await app.close();
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const check = args[0] === '--check';
const file = check ? args[1] : args[0];
if (!file || args.length !== (check ? 2 : 1)) {
  console.error(USAGE);
  process.exit(2);
}

const generated = await generate();
if (!check) {
  await writeFile(file, generated);
  console.log(`Especificação gravada em ${file}.`);
} else if ((await readIfExists(file)) === generated) {
  console.log(`A cópia da especificação em ${file} está igual à gerada dos controladores.`);
} else {
  console.error(
    `A cópia da especificação em ${file} difere da gerada dos controladores: uma rota mudou sem a cópia ser gerada de novo.`,
  );
  console.error(
    'Como corrigir: gere a cópia com `docker compose -f compose.dev.yaml exec api pnpm openapi:generate`, confira a mudança no diff e faça o commit dela.',
  );
  process.exit(1);
}
