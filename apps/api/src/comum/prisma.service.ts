import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { CONFIGURACAO, type Configuracao } from './configuracao.js';

// Os prazos do banco, para toda consulta da api. Sem eles, o `pg` espera sem limite.
/** Quanto a abertura de uma conexão, ou a espera por uma livre no pool, pode demorar. */
const PRAZO_CONEXAO_MS = 5000;
/** Quanto uma consulta pode demorar: depois disso, o PostgreSQL a cancela. */
const PRAZO_CONSULTA_MS = 30_000;

/** O cliente do Prisma da api, sobre o driver `pg`. Conecta na primeira consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(CONFIGURACAO) configuracao: Configuracao) {
    super({
      adapter: new PrismaPg({
        connectionString: configuracao.databaseUrl,
        connectionTimeoutMillis: PRAZO_CONEXAO_MS,
        statement_timeout: PRAZO_CONSULTA_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
