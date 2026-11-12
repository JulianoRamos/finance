import { defineConfig, env } from 'prisma/config';

// A configuração da linha de comando do Prisma (generate, migrate). A aplicação não lê este arquivo:
// a conexão dela vem da configuração em src/comum/.
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
