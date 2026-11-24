import { redirect } from 'next/navigation';

import type { AccountBalance } from '@/api/accounts';
import type { DataResult } from '@/api/api-error';

/** O saldo calculado numa data, como o diálogo do ajuste o mostra: o valor, ou por que não há. */
export type BalanceOnDate =
  | { readonly ok: true; readonly balance: string }
  | { readonly ok: false; readonly message: string; readonly retry: boolean };

/** A falha de leitura do saldo, que vale pedir de novo. */
export const BALANCE_UNAVAILABLE: BalanceOnDate = {
  ok: false,
  message: 'Não foi possível carregar o saldo nessa data.',
  retry: true,
};

/**
 * A resposta da rota do saldo como o diálogo do ajuste a mostra; sem sessão, vai para o login. A data antes
 * do saldo inicial é uma recusa definitiva, que não vale pedir de novo.
 */
export function balanceOnDate(result: DataResult<AccountBalance>): BalanceOnDate {
  if (result.ok) return { ok: true, balance: result.data.balance };
  if (result.code === 'UNAUTHENTICATED') redirect('/login');
  if (result.code !== 'DATE_BEFORE_OPENING_BALANCE') return BALANCE_UNAVAILABLE;
  return { ok: false, message: 'Sem saldo nesse dia: escolha uma data a partir da do saldo inicial.', retry: false };
}
