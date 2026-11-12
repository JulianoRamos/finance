import { execFileSync } from 'node:child_process';

/** Aplica as migrações no banco de teste, o de DATABASE_URL_TEST, antes da suíte. */
export default function setupDatabase(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST não está definida. Rode os testes no contêiner da api, que a recebe do compose.dev.yaml.',
    );
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
