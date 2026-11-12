import { Injectable } from '@nestjs/common';

import { type AuditAction, currentRequestContext } from '../../common/index.js';
import { toSnapshot } from './snapshot.js';

/** Uma alteração de registro, como o módulo que a fez a descreve à Auditoria. */
export interface AuditEntry {
  /** O que o comando fez com o registro. */
  readonly action: AuditAction;
  /** O nome da tabela do registro, no banco (snake_case). */
  readonly tableName: string;
  readonly recordId: string;
  /** A entidade a que o registro pertence, ou nulo no registro que não é de uma entidade. */
  readonly entityId: string | null;
  /** O registro antes do comando, como o módulo o lê, ou nulo no create. */
  readonly before: Record<string, unknown> | null;
  /** O registro depois do comando, ou nulo no delete. */
  readonly after: Record<string, unknown> | null;
}

/** O serviço público da Auditoria (LLD, seção 4.4). */
@Injectable()
export class AuditService {
  /**
   * Grava o registro de auditoria de uma alteração, na transação do comando que a fez, com o usuário e
   * o identificador da requisição do contexto. Recusa a gravação fora de uma transação: a auditoria
   * nunca fica para trás nem à frente do dado.
   */
  async record(entry: AuditEntry): Promise<void> {
    const context = currentRequestContext();
    if (!context?.transaction) {
      throw new Error('A auditoria só é gravada dentro da transação do comando que fez a alteração.');
    }
    await context.transaction.auditLog.create({
      data: {
        userId: context.userId,
        action: entry.action,
        tableName: entry.tableName,
        recordId: entry.recordId,
        entityId: entry.entityId,
        requestId: context.requestId,
        // O antes e o depois ausentes ficam nulos no banco, e o occurredAt fica com o padrão do banco,
        // o instante da transação.
        ...(entry.before && { before: toSnapshot(entry.before) }),
        ...(entry.after && { after: toSnapshot(entry.after) }),
      },
    });
  }
}
