import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';
import { CONFIG, type Config } from './config.js';

// Os prazos do banco, para toda consulta da api. Sem eles, o `pg` espera sem limite.
/** Quanto a abertura de uma conexão, ou a espera por uma livre no pool, pode demorar. */
const CONNECTION_TIMEOUT_MS = 5000;
/** Quanto uma consulta pode demorar: depois disso, o PostgreSQL a cancela. */
const STATEMENT_TIMEOUT_MS = 30_000;

/** O cliente do Prisma da api, sobre o driver `pg`. Conecta na primeira consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(CONFIG) config: Config) {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
