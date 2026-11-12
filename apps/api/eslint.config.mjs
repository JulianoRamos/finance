import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// As fronteiras de import da api (LLD, seção 3, e AGENTS.md da api, "Camadas e imports"). Cada
// pasta de src/modulos/ é um módulo, e os outros só importam o index.ts dele.
const elementos = [
  { type: 'modulo', pattern: 'src/modulos/*', capture: ['nome'] },
  { type: 'comum', pattern: 'src/comum' },
  { type: 'gerado', pattern: 'src/generated' },
  { type: 'cli', pattern: 'src/cli' },
  { type: 'teste', pattern: 'test' },
  // Por último: os arquivos soltos em src/ (main.ts, app.ts, app.module.ts), que montam a app.
  { type: 'raiz', pattern: 'src' },
];

const indice = (type) => ({ element: { type, fileInternalPath: 'index.ts' } });

export default tseslint.config(
  { ignores: ['dist/', '.openapi/', 'reports/', 'src/generated/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    rules: {
      // Os módulos do Nest são classes vazias com decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elementos,
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Um módulo usa o comum e os outros módulos só pelo index.ts.
            { from: { element: { type: 'modulo' } }, allow: { to: [indice('comum'), indice('modulo')] } },
            // O comum é a base: não conhece os módulos. Só ele usa o cliente gerado do Prisma.
            { from: { element: { type: 'comum' } }, allow: { to: { element: { type: 'gerado' } } } },
            // A montagem da app junta os módulos.
            {
              from: { element: { type: 'raiz' } },
              allow: { to: [{ element: { type: 'raiz' } }, indice('comum'), indice('modulo')] },
            },
            // Os comandos e os testes montam a app pela raiz.
            {
              from: { element: { type: ['cli', 'teste'] } },
              allow: { to: [{ element: { type: 'raiz' } }, indice('comum'), indice('modulo')] },
            },
          ],
        },
      ],
    },
  },
  prettier,
);
