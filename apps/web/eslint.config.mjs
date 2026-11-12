import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// As camadas da web (AGENTS.md da web, "Camadas e imports"): as rotas do App Router e o proxy usam o
// acesso à api, e o acesso à api não conhece nenhum dos dois.
const elements = [
  { type: 'api', pattern: 'src/api' },
  { type: 'app', pattern: 'src/app' },
  // Por último: os arquivos soltos em src/, como o proxy.ts.
  { type: 'root', pattern: 'src' },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [{ from: { element: { type: ['app', 'root'] } }, allow: { to: { element: { type: 'api' } } } }],
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    '.next/**',
    'reports/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/api/schema.d.ts',
  ]),
]);
