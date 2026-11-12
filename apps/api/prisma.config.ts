import { defineConfig, env } from 'prisma/config';

// A configuração da linha de comando do Prisma (generate, migrate). A aplicação não lê este arquivo:
// a conexão dela vem da configuração em src/common/. As migrações rodam com o papel dono das tabelas, e
// não com o da api (LLD, seção 4.4).
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_OWNER_URL'),
  },
});
