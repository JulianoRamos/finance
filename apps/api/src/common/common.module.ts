import { Global, Module } from '@nestjs/common';

import { CONFIG, readConfig } from './config.js';
import { PrismaService } from './prisma.service.js';

/** A configuração e o cliente do banco, disponíveis para todos os módulos. */
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => readConfig(process.env) }, PrismaService],
  exports: [CONFIG, PrismaService],
})
export class CommonModule {}
