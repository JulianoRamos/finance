import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../common/index.js';
import type { DatabaseState } from './health.dto.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confere o banco com uma consulta trivial, dentro dos prazos do driver (common/prisma.service.ts).
   * A falha fica só no log da api: quem chama recebe o estado, e nunca a mensagem do driver.
   */
  async databaseState(): Promise<DatabaseState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      this.logger.warn(`O banco não respondeu: ${error instanceof Error ? error.message : String(error)}`);
      return 'down';
    }
  }
}
