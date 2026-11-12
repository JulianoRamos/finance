import { Global, Module } from '@nestjs/common';

import { CONFIG, readConfig } from './config.js';
import { PrismaService } from './prisma.service.js';
import { TransactionService } from './transaction.service.js';

/** A configuração, o cliente do banco e a transação do comando, disponíveis para todos os módulos. */
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => readConfig(process.env) }, PrismaService, TransactionService],
  exports: [CONFIG, PrismaService, TransactionService],
})
export class CommonModule {}
