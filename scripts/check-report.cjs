// Confere o relatório JSON de uma suíte: ele tem de existir, ter rodado ao menos um teste,
// sem falha e sem teste pulado. Teste instável (falhou e passou na nova tentativa) vira aviso.
//
// Roda dentro do contêiner do projeto, lido pela entrada padrão (ver scripts/verify.sh):
//   node - <vitest|playwright> <arquivo do relatório>

const fs = require('node:fs');

const [kind, file] = process.argv.slice(2);

function fail(message) {
  console.error(`Relatório ${file}: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail('não foi gerado. Sem relatório, não há evidência de que a suíte rodou.');
}

let report;
try {
  report = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  fail(`não é um JSON válido (${error.message}).`);
}

/** Títulos dos testes do Playwright que só passaram na nova tentativa. */
function flakyTitles(suite, path = []) {
  const here = suite.title ? [...path, suite.title] : path;
  const own = (suite.specs ?? [])
    .filter((spec) => spec.tests.some((test) => test.status === 'flaky'))
    .map((spec) => [...here, spec.title].join(' › '));
  const nested = (suite.suites ?? []).flatMap((child) => flakyTitles(child, here));
  return [...own, ...nested];
}

let counts;
if (kind === 'vitest') {
  counts = {
    total: report.numTotalTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests + report.numTodoTests,
    flaky: [],
  };
} else if (kind === 'playwright') {
  const { expected, unexpected, skipped, flaky } = report.stats;
  counts = {
    total: expected + unexpected + skipped + flaky,
    failed: unexpected,
    skipped,
    flaky: report.suites.flatMap((suite) => flakyTitles(suite)),
  };
} else {
  fail(`tipo de relatório desconhecido: ${kind}.`);
}

for (const title of counts.flaky) {
  // O formato `::warning` vira anotação no PR quando roda no GitHub Actions.
  console.log(`::warning title=Teste instável::${title} falhou e só passou na nova tentativa.`);
}

if (!Number.isInteger(counts.total) || counts.total === 0) {
  fail('nenhum teste rodou.');
}
if (counts.failed > 0) {
  fail(`${counts.failed} teste(s) falharam.`);
}
if (counts.skipped > 0) {
  fail(`${counts.skipped} teste(s) foram pulados.`);
}

console.log(`Relatório ${file}: ${counts.total} teste(s), nenhum pulado.`);
