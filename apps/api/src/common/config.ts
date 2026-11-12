/** O token da configuração da api na injeção de dependências. */
export const CONFIG = Symbol('CONFIG');

/** A configuração da api, lida das variáveis de ambiente (LLD, seção 9). */
export interface Config {
  readonly databaseUrl: string;
  readonly port: number;
}

/** Lê e valida a configuração. Falha na subida, dizendo o que falta, em vez de na primeira requisição. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('A variável DATABASE_URL não está definida: ela é a conexão com o banco.');
  }
  const port = Number(env.PORT ?? '3001');
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`A variável PORT não é uma porta válida: ${env.PORT ?? ''}.`);
  }
  return { databaseUrl, port };
}
