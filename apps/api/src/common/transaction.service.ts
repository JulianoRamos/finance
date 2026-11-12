import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';
import { currentRequestContext, runInRequestContext } from './request-context.js';

/** O cliente do banco dentro de uma transação. */
export type Transaction = Prisma.TransactionClient;

/**
 * A transação do comando, que corre pelo contexto da requisição (LLD, seção 3, "Transação"): o serviço
 * que recebe a requisição a abre, e os serviços que ele chama a usam pelo client.
 */
@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roda o comando numa transação, posta no contexto da requisição, e a confirma no fim, ou a desfaz se
   * ele falhar. Dentro de uma transação aberta, o comando roda nela.
   */
  async run<T>(command: () => Promise<T>): Promise<T> {
    const context = currentRequestContext();
    if (!context) throw new Error('O comando precisa de um contexto da requisição para abrir a transação.');
    if (context.transaction) return command();
    return this.prisma.$transaction((transaction) => runInRequestContext({ ...context, transaction }, command));
  }

  /** O cliente do banco: o da transação corrente, ou o de fora de uma transação. */
  get client(): Transaction {
    return currentRequestContext()?.transaction ?? this.prisma;
  }
}
