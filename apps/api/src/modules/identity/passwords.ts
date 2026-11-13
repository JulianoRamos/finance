import { randomUUID } from 'node:crypto';

import { hash, verify } from '@node-rs/argon2';

/** O hash argon2id da senha, com os parâmetros padrão do @node-rs/argon2. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Um hash que nenhuma senha confere, para o login de um e-mail sem usuário gastar o mesmo tempo que o
 * de um que existe (regra 6.1). Calculado uma vez, na carga do módulo, para nem a primeira conferência
 * demorar mais.
 */
const unmatchableHash = hash(randomUUID());

/**
 * Se a senha confere com o hash. Sem hash (o e-mail sem usuário, ou o usuário sem senha), confere
 * contra um hash fixo e responde não, no mesmo tempo.
 */
export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (passwordHash !== null) return verify(passwordHash, password);
  await verify(await unmatchableHash, password);
  return false;
}
