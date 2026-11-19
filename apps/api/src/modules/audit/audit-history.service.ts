import { Injectable } from '@nestjs/common';

import { type JsonObject, type PageRequest, readPage, sql, TransactionService } from '../../common/index.js';
import type { AuditHistoryEntry, AuditHistoryPage } from './audit.dto.js';
import { changesOf } from './changes.js';
import { UserNamesRegistry } from './user-names.js';

/** Uma tabela que entra no histórico, como o módulo dono dela a descreve. */
export interface HistorySource {
  /** O nome da tabela, no banco (snake_case). */
  readonly tableName: string;
  /** Os campos que o usuário vê, com os nomes do modelo, na ordem em que aparecem. */
  readonly fields: readonly string[];
  /**
   * O campo do registro com o id da outra entidade de que a alteração fala, como o sócio numa
   * participação. O nome dela vai no `subject`.
   */
  readonly subjectField?: string;
}

/** O que o histórico de uma entidade pede à Auditoria. */
export interface HistoryRequest {
  /** As tabelas que entram, com os campos de cada uma. */
  readonly sources: readonly HistorySource[];
  /** O nome de cada entidade dos ids, para o `subject`. Vem do módulo dono das entidades. */
  readonly subjectNames: (ids: readonly string[]) => Promise<ReadonlyMap<string, string>>;
}

/** O registro de auditoria, como o Prisma o lê. */
type AuditRow = Awaited<ReturnType<TransactionService['client']['auditLog']['findMany']>>[number];

/** Um registro da página, com a tabela dele no pedido e o id do `subject`, lidos uma vez. */
interface PageRow {
  readonly row: AuditRow;
  readonly source: HistorySource | undefined;
  readonly before: JsonObject | null;
  readonly after: JsonObject | null;
  readonly subjectId: string | null;
}

/** O histórico de alterações (LLD, seção 4.4): a página das alterações de uma entidade, campo a campo. */
@Injectable()
export class AuditHistoryService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly userNames: UserNamesRegistry,
  ) {}

  /**
   * A página das alterações da entidade nas tabelas pedidas, da mais recente para a mais antiga (o
   * `occurred_at`, e o `id` no empate), com o total. A alteração que não muda nenhum campo pedido entra
   * do mesmo jeito, com a lista de campos vazia.
   */
  async entityHistory(entityId: string, request: HistoryRequest, page: PageRequest): Promise<AuditHistoryPage> {
    const sources = new Map(request.sources.map((source) => [source.tableName, source]));
    const client = this.transactions.client;
    const found = await readPage(
      client,
      sql`SELECT id, occurred_at FROM audit_log
        WHERE entity_id = ${entityId}::uuid AND table_name = ANY(${[...sources.keys()]}::text[])`,
      sql`occurred_at DESC, id DESC`,
      page,
      async (ids) =>
        (await client.auditLog.findMany({ where: { id: { in: ids.map((id) => BigInt(id)) } } })).map((row) => ({
          id: row.id.toString(),
          row,
        })),
    );
    const rows = found.items.map(({ row }) => pageRow(row, sources.get(row.tableName)));

    const [users, subjects] = await Promise.all([
      namesOf(
        rows.map(({ row }) => row.userId),
        (ids) => this.userNames.namesOf(ids),
      ),
      namesOf(
        rows.map(({ subjectId }) => subjectId),
        (ids) => request.subjectNames(ids),
      ),
    ]);

    return {
      ...found,
      items: rows.map(({ row, source, before, after, subjectId }): AuditHistoryEntry => {
        const userName = row.userId === null ? undefined : users.get(row.userId);
        return {
          id: row.id.toString(),
          occurredAt: row.occurredAt,
          user: row.userId === null || userName === undefined ? null : { id: row.userId, name: userName },
          action: row.action,
          tableName: row.tableName,
          recordId: row.recordId,
          subject: subjectId === null ? null : (subjects.get(subjectId) ?? null),
          changes: changesOf(row.action, before, after, source?.fields ?? []),
        };
      }),
    };
  }
}

/** Os nomes dos ids dados, sem repetir nem pedir quando não há nenhum. */
async function namesOf(
  ids: readonly (string | null)[],
  read: (ids: readonly string[]) => Promise<ReadonlyMap<string, string>>,
): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(ids.filter((id) => id !== null))];
  return unique.length > 0 ? read(unique) : new Map();
}

/** O antes ou o depois do registro, como a auditoria o gravou: um objeto, ou nulo. */
function asObject(value: AuditRow['before']): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * O registro com o antes e o depois lidos e o id da outra entidade de que a alteração fala, do depois
 * ou, na exclusão, do antes.
 */
function pageRow(row: AuditRow, source: HistorySource | undefined): PageRow {
  const before = asObject(row.before);
  const after = asObject(row.after);
  const subject = source?.subjectField ? (after ?? before)?.[source.subjectField] : undefined;
  return { row, source, before, after, subjectId: typeof subject === 'string' ? subject : null };
}
