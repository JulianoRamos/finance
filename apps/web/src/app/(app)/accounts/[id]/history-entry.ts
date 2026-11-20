import type { AuditHistoryEntry } from '@/api/entities';

import { ACCOUNT_TYPE_NAMES, INSTITUTION_NAMES } from '../../../_shell/account-text';
import { formatCalendarDate, formatInstant } from '../../../_shell/format';
import type { HistoryItem, HistoryLine } from '../../../_shell/history-panel';
import { formatMoney } from '../../../_shell/money';

// O histórico da conta como o painel o mostra: a api devolve o que mudou em JSON, campo a campo.

type Change = AuditHistoryEntry['changes'][number];

/** O rótulo e o formato de cada campo da conta que a tela mostra. O ativo vai na frase. */
const FIELDS: Readonly<Record<string, { label: string; format: (value: string) => string }>> = {
  name: { label: 'Nome', format: (name) => name },
  type: { label: 'Tipo', format: (type) => ACCOUNT_TYPE_NAMES[type as keyof typeof ACCOUNT_TYPE_NAMES] },
  institution: {
    label: 'Banco',
    format: (institution) => INSTITUTION_NAMES[institution as keyof typeof INSTITUTION_NAMES],
  },
  isReserve: { label: 'Conta de reserva', format: (reserve) => (reserve === 'true' ? 'Sim' : 'Não') },
  openingBalance: { label: 'Saldo inicial', format: formatMoney },
  openingBalanceDate: { label: 'Data do saldo inicial', format: formatCalendarDate },
};

/** As linhas dos campos que a tela mostra, cada um com o antes e o depois formatados, ou nulos quando vazios. */
function lines(changes: readonly Change[]): HistoryLine[] {
  return changes.flatMap((change): HistoryLine[] => {
    const field = FIELDS[change.field];
    if (!field) return [];
    const shown = (value: Change['before']) => (value === null ? null : field.format(String(value)));
    return [{ label: field.label, before: shown(change.before), after: shown(change.after) }];
  });
}

/** O que a alteração fez, na frase: criou, desativou, reativou, alterou o saldo inicial ou alterou. */
function action(entry: AuditHistoryEntry): string {
  if (entry.action === 'create') return 'criou a conta';
  const fields = entry.changes.map((change) => change.field);
  const [only] = entry.changes;
  if (fields.length === 1 && only?.field === 'active') {
    return only.after === false ? 'desativou a conta' : 'reativou a conta';
  }
  if (fields.length > 0 && fields.every((field) => field.startsWith('openingBalance')))
    return 'alterou o saldo inicial';
  return 'alterou';
}

/** A alteração como o painel do histórico da conta a mostra; sem usuário, quem fez é "O sistema". */
export function accountHistoryItem(entry: AuditHistoryEntry): HistoryItem {
  return {
    id: entry.id,
    sentence: `${entry.user?.name ?? 'O sistema'} ${action(entry)}`,
    occurredAt: formatInstant(entry.occurredAt),
    lines: lines(entry.changes),
  };
}
