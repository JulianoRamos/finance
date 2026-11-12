import { Global, Module } from '@nestjs/common';

import { CONFIGURACAO, lerConfiguracao } from './configuracao.js';
import { PrismaService } from './prisma.service.js';

/** A configuração e o cliente do banco, disponíveis para todos os módulos. */
@Global()
@Module({
  providers: [{ provide: CONFIGURACAO, useFactory: () => lerConfiguracao(process.env) }, PrismaService],
  exports: [CONFIGURACAO, PrismaService],
})
export class ComumModule {}
