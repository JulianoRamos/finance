'use server';

import { revalidatePath } from 'next/cache';

import { type ContextOptions, listContextOptions } from '@/api/financial-context';
import { isContextReference, storeFinancialContext } from '@/api/financial-context-cookie';

/** Guarda o contexto escolhido e recarrega os dados da página atual (design-system.md, seção 4.1). */
export async function chooseFinancialContextAction(reference: string): Promise<void> {
  if (!isContextReference(reference)) return;
  await storeFinancialContext(reference);
  revalidatePath('/', 'layout');
}

/** As escolhas do seletor para a busca, pedidas à api; nulo quando ela não responde. */
export async function searchFinancialContextsAction(q: string): Promise<ContextOptions | null> {
  return listContextOptions(q.trim());
}
