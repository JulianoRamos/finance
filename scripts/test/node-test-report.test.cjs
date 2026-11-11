// Prova que o repórter do `node:test` grava o relatório no formato do Vitest que o conferidor de
// aceite lê: um teste por entrada, com o título, as tags e o estado. Roda com o runner nativo do Node.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPORTER = path.join(__dirname, 'node-test-report.cjs');

test('o repórter do node:test grava o relatório no formato do Vitest, com título e estado de cada teste', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-'));
  const sample = path.join(dir, 'sample.test.cjs');
  fs.writeFileSync(
    sample,
    [
      "const { test, describe } = require('node:test');",
      "test('passa @PROJ-9-CA1', () => {});",
      "test('@PROJ-9-CA2', () => {});",
      "test('falha', () => { throw new Error('x'); });",
      "test('pulado', { skip: true }, () => {});",
      "test('a fazer', { todo: true }, () => {});",
      "describe('grupo', () => { test('dentro', () => {}); });",
    ].join('\n'),
  );
  const out = path.join(dir, 'report.json');
  // O `node --test` que roda este teste deixa `NODE_TEST_CONTEXT` no ambiente: sem tirá-lo, o filho
  // se comporta como subprocesso do runner e não grava o relatório.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  spawnSync(
    process.execPath,
    ['--test', `--test-reporter=${REPORTER}`, `--test-reporter-destination=${out}`, sample],
    { cwd: dir, env, encoding: 'utf8' },
  );
  let report;
  try {
    report = JSON.parse(fs.readFileSync(out, 'utf8'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  const totals = [report.numTotalTests, report.numFailedTests, report.numPendingTests, report.numTodoTests];

  const byTitle = Object.fromEntries(tests.map((entry) => [entry.title, entry.status]));
  assert.deepEqual(byTitle, {
    'passa @PROJ-9-CA1': 'passed',
    '@PROJ-9-CA2': 'passed',
    falha: 'failed',
    pulado: 'pending',
    'a fazer': 'todo',
    dentro: 'passed',
  });
  // O `node:test` não tem tag: o token `@<ticket>-CA<n>` do título vira também a tag do relatório, e o título fica como está.
  assert.deepEqual(Object.fromEntries(tests.map((entry) => [entry.title, entry.tags])), {
    'passa @PROJ-9-CA1': ['@PROJ-9-CA1'],
    '@PROJ-9-CA2': ['@PROJ-9-CA2'],
    falha: [],
    pulado: [],
    'a fazer': [],
    dentro: [],
  });
  // Os totais são o que o `check-report.cjs` lê para reprovar suíte vazia, falha e teste pulado.
  assert.deepEqual(totals, [6, 1, 1, 1]);
});
