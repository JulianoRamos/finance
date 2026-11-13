/** O token da configuração da api na injeção de dependências. */
export const CONFIG = Symbol('CONFIG');

/** A configuração da api, lida das variáveis de ambiente (LLD, seção 9). */
export interface Config {
  readonly databaseUrl: string;
  readonly port: number;
  /** O endereço público da web, sem a barra no fim, com que os comandos montam o link de recuperação. */
  readonly publicUrl: string;
  /** Quantos dias sem uso encerram a sessão (regra 6.1). */
  readonly sessionIdleDays: number;
  /** Quantos dias depois do login a sessão vence, mesmo em uso (regra 6.1). */
  readonly sessionMaxDays: number;
}

function required(env: NodeJS.ProcessEnv, name: string, purpose: string): string {
  const value = env[name];
  if (!value) throw new Error(`A variável ${name} não está definida: ela é ${purpose}.`);
  return value;
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: string, what: string): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`A variável ${name} não é ${what}: ${env[name] ?? ''}.`);
  }
  return value;
}

/** Lê e valida a configuração. Falha na subida, dizendo o que falta, em vez de na primeira requisição. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const databaseUrl = required(env, 'DATABASE_URL', 'a conexão com o banco');
  const publicUrl = required(env, 'PUBLIC_URL', 'o endereço público da web, para o link de recuperação');
  if (!URL.canParse(publicUrl)) {
    throw new Error(`A variável PUBLIC_URL não é um endereço válido: ${publicUrl}.`);
  }
  return {
    databaseUrl,
    port: positiveInteger(env, 'PORT', '3001', 'uma porta válida'),
    publicUrl: publicUrl.replace(/\/+$/, ''),
    sessionIdleDays: positiveInteger(env, 'SESSION_IDLE_DAYS', '7', 'um número de dias válido'),
    sessionMaxDays: positiveInteger(env, 'SESSION_MAX_DAYS', '30', 'um número de dias válido'),
  };
}
