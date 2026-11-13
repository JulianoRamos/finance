import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// As fronteiras de import da api (LLD, seção 3, e AGENTS.md da api, "Camadas e imports"). Cada
// pasta de src/modules/ é um módulo, e os outros só importam o index.ts dele.
const elements = [
  { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
  { type: 'common', pattern: 'src/common' },
  { type: 'generated', pattern: 'src/generated' },
  { type: 'cli', pattern: 'src/cli' },
  { type: 'test', pattern: 'test' },
  // Por último: os arquivos soltos em src/ (main.ts, app.ts, app.module.ts), que montam a app.
  { type: 'root', pattern: 'src' },
];

const index = (type) => ({ element: { type, fileInternalPath: 'index.ts' } });

// Quem pode chamar quem entre os módulos (LLD, seção 3), com as pastas dos módulos que já existem.
// Um módulo fora da tabela, como o health, não chama nenhum outro.
const calls = {
  identity: ['entities', 'audit'],
  entities: ['audit'],
  audit: [],
};

/** O index.ts de um dos módulos dados. */
const moduleIndex = (names) => ({
  element: { type: 'module', captured: { name: names }, fileInternalPath: 'index.ts' },
});

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
      'boundaries/elements': elements,
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // Um módulo usa o common pelo index.ts, e os outros módulos, os que a tabela permite, também.
            { from: { element: { type: 'module' } }, allow: { to: index('common') } },
            ...Object.entries(calls)
              .filter(([, callees]) => callees.length > 0)
              .map(([name, callees]) => ({
                from: { element: { type: 'module', captured: { name } } },
                allow: { to: moduleIndex(callees) },
              })),
            // O common é a base: não conhece os módulos. Só ele usa o cliente gerado do Prisma.
            { from: { element: { type: 'common' } }, allow: { to: { element: { type: 'generated' } } } },
            // A montagem da app junta os módulos.
            {
              from: { element: { type: 'root' } },
              allow: { to: [{ element: { type: 'root' } }, index('common'), index('module')] },
            },
            // Os comandos e os testes montam a app pela raiz. Os testes chamam os comandos pela função
            // que o executável deles chama.
            {
              from: { element: { type: 'cli' } },
              allow: {
                to: [{ element: { type: 'root' } }, { element: { type: 'cli' } }, index('common'), index('module')],
              },
            },
            {
              from: { element: { type: 'test' } },
              allow: {
                to: [
                  { element: { type: 'root' } },
                  { element: { type: 'test' } },
                  { element: { type: 'cli', fileInternalPath: 'commands.ts' } },
                  index('common'),
                  index('module'),
                ],
              },
            },
          ],
        },
      ],
    },
  },
  prettier,
);
