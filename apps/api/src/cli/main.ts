import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module.js';
import { runCommand } from './commands.js';

// Os comandos da api no servidor (LLD, seção 6.1), pelo script cli do package.json:
//
//   pnpm cli create-user <nome> <email>
//   pnpm cli recover-access <email>
//
// Monta a app sem abrir a porta, roda o comando e sai com o código dele.

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
let code: number;
try {
  code = await runCommand(app, process.argv.slice(2), {
    out: (line) => {
      console.log(line);
    },
    err: (line) => {
      console.error(line);
    },
  });
} finally {
  await app.close();
}
process.exit(code);
