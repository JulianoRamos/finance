import 'server-only';

import { cookies } from 'next/headers';

import { privateCookieOptions } from './private-cookie';

/** O cookie que guarda o contexto financeiro escolhido, que só o servidor da web lê (regra 6.2). */
const FINANCIAL_CONTEXT_COOKIE = 'financial_context';

/** Por quanto tempo a escolha fica guardada: um ano. */
const ONE_YEAR_S = 365 * 24 * 60 * 60;

const REFERENCE = /^(entity|group):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Se o valor é um contexto na forma do cabeçalho: `entity:<id>` ou `group:<id>`. */
export function isContextReference(value: string): boolean {
  return REFERENCE.test(value);
}

/** O contexto guardado no cookie, ou nulo sem um na forma certa. */
export async function storedFinancialContext(): Promise<string | null> {
  const value = (await cookies()).get(FINANCIAL_CONTEXT_COOKIE)?.value;
  return value !== undefined && isContextReference(value) ? value : null;
}

/** Guarda o contexto escolhido, por um ano. */
export async function storeFinancialContext(reference: string): Promise<void> {
  (await cookies()).set(FINANCIAL_CONTEXT_COOKIE, reference, { ...privateCookieOptions(), maxAge: ONE_YEAR_S });
}
