import type { AccountType, Institution } from '@/api/accounts';

// Os nomes do tipo e do banco de uma conta, como a tela, a lista e a paleta de pesquisa os mostram.

/** O nome de cada tipo de conta. */
export const ACCOUNT_TYPE_NAMES: Readonly<Record<AccountType, string>> = {
  checking: 'Conta corrente',
  payment: 'Conta de pagamento',
  cash: 'Dinheiro em espécie',
};

/** O nome de cada banco, na ordem da escolha do formulário. */
export const INSTITUTION_NAMES: Readonly<Record<Institution, string>> = {
  nubank: 'Nubank',
  caixa: 'Caixa',
  mercado_pago: 'Mercado Pago',
  bradesco: 'Bradesco',
  itau: 'Itaú',
  banco_do_brasil: 'Banco do Brasil',
  other: 'Outro',
};

/** O selo da conta: "Desativada" na desativada, "Reserva" na conta de reserva, ou nenhum. */
export function accountBadge(account: { readonly active: boolean; readonly isReserve: boolean }): string | null {
  if (!account.active) return 'Desativada';
  return account.isReserve ? 'Reserva' : null;
}

/** Se a conta é o dinheiro em espécie fora de um banco, que a tela diz "Em espécie" no lugar do banco. */
function isLooseCash(account: { readonly type?: AccountType; readonly institution: Institution }): boolean {
  return account.type === 'cash' && account.institution === 'other';
}

/** O banco como a lista o diz: "Em espécie" no dinheiro que não está num banco. */
export function bankText(account: { readonly type?: AccountType; readonly institution: Institution }): string {
  return isLooseCash(account) ? 'Em espécie' : INSTITUTION_NAMES[account.institution];
}

/**
 * O resumo do detalhe da conta: o tipo, o banco e a entidade dona, como "Conta corrente · Nubank · Ana
 * Lima". No dinheiro em espécie, o tipo já diz o que o banco diria.
 */
export function accountSummary(account: {
  readonly type: AccountType;
  readonly institution: Institution;
  readonly entityName: string;
}): string {
  const bank = isLooseCash(account) ? [] : [INSTITUTION_NAMES[account.institution]];
  return [ACCOUNT_TYPE_NAMES[account.type], ...bank, account.entityName].join(' · ');
}
