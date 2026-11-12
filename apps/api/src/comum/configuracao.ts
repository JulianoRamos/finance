/** O token da configuração da api na injeção de dependências. */
export const CONFIGURACAO = Symbol('CONFIGURACAO');

/** A configuração da api, lida das variáveis de ambiente (LLD, seção 9). */
export interface Configuracao {
  readonly databaseUrl: string;
  readonly porta: number;
}

/** Lê e valida a configuração. Falha na subida, dizendo o que falta, em vez de na primeira requisição. */
export function lerConfiguracao(env: NodeJS.ProcessEnv): Configuracao {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('A variável DATABASE_URL não está definida: ela é a conexão com o banco.');
  }
  const porta = Number(env.PORTA ?? '3001');
  if (!Number.isInteger(porta) || porta <= 0) {
    throw new Error(`A variável PORTA não é uma porta válida: ${env.PORTA ?? ''}.`);
  }
  return { databaseUrl, porta };
}
