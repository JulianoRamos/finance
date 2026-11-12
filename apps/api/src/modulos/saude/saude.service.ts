import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../comum/index.js';
import type { EstadoBanco } from './saude.dto.js';

@Injectable()
export class SaudeService {
  private readonly logger = new Logger(SaudeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confere o banco com uma consulta trivial, dentro dos prazos do driver (comum/prisma.service.ts).
   * A falha fica só no log da api: quem chama recebe o estado, e nunca a mensagem do driver.
   */
  async estadoDoBanco(): Promise<EstadoBanco> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'conectado';
    } catch (erro) {
      this.logger.warn(`O banco não respondeu: ${erro instanceof Error ? erro.message : String(erro)}`);
      return 'fora_do_ar';
    }
  }
}
