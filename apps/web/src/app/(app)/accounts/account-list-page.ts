import type { Account } from '@/api/accounts';

import { accountBadge, bankText } from '../../_shell/account-text';

/** Uma conta como a lista a mostra, já formatada. */
export interface AccountListItem {
  readonly id: string;
  readonly name: string;
  /** O selo: "Reserva" na conta de reserva, "Desativada" na desativada, ou nenhum. */
  readonly badge: string | null;
  /** A segunda linha: a entidade dona e o banco, como "Ana Lima · Nubank". */
  readonly detail: string;
  /** O saldo de hoje, a string decimal da api, que o Valor mostra. */
  readonly balance: string;
  readonly active: boolean;
}

/** A conta como a lista a mostra (design-system.md, seção 4.1), com o saldo de hoje à direita. */
export function accountListItem(account: Account): AccountListItem {
  return {
    id: account.id,
    name: account.name,
    active: account.active,
    badge: accountBadge(account),
    detail: `${account.entityName} · ${bankText(account)}`,
    balance: account.balance,
  };
}
