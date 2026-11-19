import type { AuditHistoryEntry, EntityType } from '@/api/entities';

import { formatCalendarDate, formatFraction, formatInstant } from '../../../_shell/format';
import { formatTaxId } from '../tax-id-format';

// O histórico de alterações como o painel o mostra (LLD, seção 4.4): cada alteração numa frase, com os
// campos nos rótulos e nos formatos da tela. A api devolve o que mudou em JSON, campo a campo.

/** Um campo que mudou, já formatado: o valor vazio é nulo, e a tela o diz "vazio". */
export interface HistoryLine {
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
}

/** Uma alteração como o painel a mostra. */
export interface HistoryItem {
  readonly id: string;
  /** A frase: quem fez e o quê, como "Ana Lima alterou". */
  readonly sentence: string;
  /** Quando, como `dd/mm/aaaa hh:mm`. */
  readonly occurredAt: string;
  readonly lines: readonly HistoryLine[];
}

/** O nome de cada operação, como a tela o mostra. */
const OPERATION_NAMES: Readonly<Record<string, string>> = { clinic: 'Clínica' };

type Change = AuditHistoryEntry['changes'][number];
type Value = Change['before'];

/** O valor do campo, de antes ou de depois, formatado como a tela o mostra, ou nulo quando vazio. */
function shown(value: Value, format: (text: string) => string = (text) => text): string | null {
  return value === null ? null : format(String(value));
}

/** O valor de um campo nas mudanças, do lado dado. */
function valueOf(changes: readonly Change[], field: string, side: 'before' | 'after'): Value {
  return changes.find((change) => change.field === field)?.[side] ?? null;
}

/** As linhas dos campos da entidade que a tela mostra: o nome e o documento. O tipo e o ativo vão na frase. */
function entityLines(changes: readonly Change[], type: EntityType): HistoryLine[] {
  const formats: Readonly<Record<string, { label: string; format?: (text: string) => string }>> = {
    name: { label: 'Nome' },
    taxId: { label: 'Documento', format: (taxId) => formatTaxId(type, taxId) },
  };
  return changes.flatMap((change): HistoryLine[] => {
    const field = formats[change.field];
    if (!field) return [];
    return [
      { label: field.label, before: shown(change.before, field.format), after: shown(change.after, field.format) },
    ];
  });
}

/** O que a entidade fez, na frase: criou, desativou, reativou ou alterou. */
function entityAction(entry: AuditHistoryEntry): string {
  if (entry.action === 'create') return 'criou a entidade';
  if (entry.action === 'delete') return 'excluiu a entidade';
  const [only] = entry.changes;
  if (entry.changes.length === 1 && only?.field === 'active') {
    return only.after === false ? 'desativou a entidade' : 'reativou a entidade';
  }
  return 'alterou';
}

/** A participação como a tela a diz: "25,0% desde 01/11/2026" ou "25,0% de 01/11/2026 a 31/12/2026". */
function stakeText(changes: readonly Change[], side: 'before' | 'after'): string | null {
  const percent = shown(valueOf(changes, 'fraction', side), formatFraction);
  const start = shown(valueOf(changes, 'startDate', side), formatCalendarDate);
  if (percent === null || start === null) return null;
  const end = shown(valueOf(changes, 'endDate', side), formatCalendarDate);
  return end === null ? `${percent} desde ${start}` : `${percent} de ${start} a ${end}`;
}

/** As linhas da participação: o registro inteiro, ou, na alteração, cada campo que mudou. */
function stakeLines(entry: AuditHistoryEntry): HistoryLine[] {
  const holder = entry.subject ?? 'Sócio';
  if (entry.action !== 'update') {
    return [{ label: holder, before: stakeText(entry.changes, 'before'), after: stakeText(entry.changes, 'after') }];
  }
  const labels: Readonly<Record<string, string>> = { fraction: 'fração', startDate: 'início', endDate: 'último dia' };
  return entry.changes.map((change) => {
    const format = change.field === 'fraction' ? formatFraction : formatCalendarDate;
    return {
      label: `${holder}, ${labels[change.field] ?? change.field}`,
      before: shown(change.before, format),
      after: shown(change.after, format),
    };
  });
}

/** A frase e as linhas de uma alteração, pela tabela dela. */
function describe(entry: AuditHistoryEntry, type: EntityType): { action: string; lines: HistoryLine[] } {
  if (entry.tableName === 'entity_operation') {
    const operation = valueOf(entry.changes, 'operation', entry.action === 'delete' ? 'before' : 'after');
    const name = OPERATION_NAMES[String(operation)] ?? String(operation);
    const enabled = entry.action !== 'delete';
    return {
      action: `${enabled ? 'ligou' : 'desligou'} a operação ${name}`,
      lines: [{ label: 'Operações', before: enabled ? 'Nenhuma' : name, after: enabled ? name : 'Nenhuma' }],
    };
  }
  if (entry.tableName === 'equity_stake') {
    let action = 'alterou uma participação';
    if (entry.action === 'create') action = 'registrou uma participação';
    else if (
      entry.action === 'update' &&
      valueOf(entry.changes, 'endDate', 'before') === null &&
      valueOf(entry.changes, 'endDate', 'after') !== null
    ) {
      action = 'encerrou uma participação';
    } else if (entry.action === 'delete') action = 'excluiu uma participação';
    return { action, lines: stakeLines(entry) };
  }
  return { action: entityAction(entry), lines: entityLines(entry.changes, type) };
}

/** A alteração como o painel do histórico da entidade a mostra; sem usuário, quem fez é "O sistema". */
export function historyItem(entry: AuditHistoryEntry, type: EntityType): HistoryItem {
  const { action, lines } = describe(entry, type);
  return {
    id: entry.id,
    sentence: `${entry.user?.name ?? 'O sistema'} ${action}`,
    occurredAt: formatInstant(entry.occurredAt),
    lines,
  };
}
