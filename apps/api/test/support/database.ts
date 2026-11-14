import { execFileSync } from 'node:child_process';

import { PrismaService, readConfig } from '../../src/common/index.js';

/** A variável de ambiente dada, que o compose.dev.yaml passa ao contêiner da api. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não está definida. Rode os testes no contêiner da api, que a recebe do compose.dev.yaml.`);
  }
  return value;
}

/** Aplica as migrações no banco da URL dada, com o papel dono, como a api faz a cada subida. */
export function migrateDeploy(ownerUrl: string, stdio: 'inherit' | 'pipe' = 'inherit'): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_OWNER_URL: ownerUrl },
    stdio,
  });
}

/** Um cliente do banco na URL dada, fora da app, como o do papel dono. */
export function databaseClient(url: string): PrismaService {
  return new PrismaService({ ...readConfig(process.env), databaseUrl: url });
}
