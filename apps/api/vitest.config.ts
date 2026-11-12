import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O SWC compila os testes com os metadados dos decorators, que a injeção de dependências do Nest lê.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // As migrações rodam no banco de teste antes da suíte, e os testes só se conectam a ele.
    globalSetup: ['test/setup-database.ts'],
    env: { DATABASE_URL: process.env.DATABASE_URL_TEST ?? '' },
    // As tags são os IDs dos critérios de aceite, que o conferidor do aceite valida contra os arquivos
    // de aceite. Declará-las uma a uma aqui repetiria esses arquivos.
    strictTags: false,
  },
});
