import { Global, Module } from '@nestjs/common';

import { CLOCK, systemClock } from './clock.js';
import { CONFIG, readConfig } from './config.js';
import { PrismaService } from './prisma.service.js';
import { TransactionService } from './transaction.service.js';

/** A configuração, o relógio, o cliente do banco e a transação do comando, para todos os módulos. */
@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => readConfig(process.env) },
    { provide: CLOCK, useValue: systemClock },
    PrismaService,
    TransactionService,
  ],
  exports: [CONFIG, CLOCK, PrismaService, TransactionService],
})
export class CommonModule {}
