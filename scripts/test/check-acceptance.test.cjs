// Testes do conferidor de aceite, pela mesma interface que o scripts/verify.sh usa: o corpo do PR,
// os arquivos de aceite e os relatórios das suítes na entrada; o código de saída e as mensagens
// na saída. Rodam com o runner nativo do Node, dentro do contêiner `harness`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECKER = path.join(__dirname, '..', 'check-acceptance.cjs');
const SKILL_PARSER = path.join(__dirname, '..', '..', '.claude', 'skills', 'plan-ticket', 'scripts', 'plan.cjs');
const { parseAcceptanceFile } = require(CHECKER);
const { parseMessage } = require(SKILL_PARSER);

function acceptanceFile(criteria) {
  return criteria
    .map(([id, check]) => `## ${id}\n\n- **Marca:** ${check}\n- **Cenário:** Dado, Quando, Então.\n`)
    .join('\n');
}

function vitestReport(tests) {
  return {
    testResults: [
      {
        name: '/work/apps/api/test/x.e2e-spec.ts',
        assertionResults: tests.map(([title, status, tags = []]) => ({
          title,
          fullName: title,
          ancestorTitles: [],
          status,
          tags,
        })),
      },
    ],
  };
}

function playwrightReport(tests) {
  return {
    suites: [
      {
        title: 'x.spec.ts',
        specs: tests.map(([title, status, tags = []]) => ({
          title,
          file: 'e2e/x.spec.ts',
          tags,
          tests: [{ status, tags }],
        })),
      },
    ],
  };
}

// A issue pai dos tickets dos testes, quando a chave de `files` não traz a própria (`<pai>/<ticket>`).
const PARENT = 'PROJ-100';

/**
 * Grava a pasta dos tickets: cada ticket numa pasta com o nome dele, dentro da pasta da issue pai,
 * com o arquivo de aceite em `aceite.md`, como o `verify.sh` a entrega.
 */
function writeTickets(ticketsDir, files) {
  fs.mkdirSync(ticketsDir, { recursive: true });
  for (const [key, text] of Object.entries(files)) {
    const folder = path.join(ticketsDir, key.includes('/') ? key : `${PARENT}/${key}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'aceite.md'), text);
  }
}

/**
 * Monta uma pasta de trabalho e roda o conferidor nela, com a pasta dos tickets relativa a ela e o
 * corpo do PR na entrada padrão (`-`), como o `verify.sh` os entrega.
 */
function check({
  mode = '--required',
  body = '## Aceite\n\nnenhum, refatoração.\n',
  files = {},
  vitest = [],
  playwright = [],
  extra = {},
  tickets = 'docs/tickets',
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aceite-'));
  const ticketsDir = path.join(dir, tickets);
  writeTickets(ticketsDir, files);
  // Os outros arquivos da pasta dos tickets, fora do versionamento, como a página do plano.
  for (const [name, text] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(ticketsDir, name)), { recursive: true });
    fs.writeFileSync(path.join(ticketsDir, name), text);
  }
  fs.writeFileSync(path.join(dir, 'unit.json'), JSON.stringify(vitestReport(vitest)));
  fs.writeFileSync(path.join(dir, 'e2e.json'), JSON.stringify(playwrightReport(playwright)));
  const result = spawnSync(
    process.execPath,
    [CHECKER, mode, '-', tickets, `vitest:${path.join(dir, 'unit.json')}`, `playwright:${path.join(dir, 'e2e.json')}`],
    { cwd: dir, input: body, encoding: 'utf8' },
  );
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: result.status, out: result.stdout + result.stderr };
}

const TICKET = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP']]) };

test('reprova um ID com marca de teste sem nenhum teste, e a mensagem diz como corrigir', () => {
  const { code, out } = check({ files: TICKET });
  assert.equal(code, 1);
  assert.match(out, /PROJ-1-CA1 .*não tem nenhum teste/);
  assert.match(out, /ponha a tag @PROJ-1-CA1 nele/);
});

test('reprova um ID de critério num teste que não está em nenhum arquivo de aceite', () => {
  const { code, out } = check({ files: TICKET, vitest: [['ok', 'passed', ['@PROJ-1-CA1']], ['órfão', 'passed', ['@PROJ-9-CA3']]] });
  assert.equal(code, 1);
  assert.match(out, /@PROJ-9-CA3, que não está em nenhum arquivo de aceite/);
});

test('reprova um teste com ID de critério que foi pulado', () => {
  const { code, out } = check({ files: TICKET, vitest: [['pulado', 'pending', ['@PROJ-1-CA1']]] });
  assert.equal(code, 1);
  assert.match(out, /PROJ-1-CA1: um teste com o ID dele foi pulado/);
});

test('reprova um teste com ID de critério que falhou', () => {
  const { code, out } = check({ files: TICKET, vitest: [['quebrado', 'failed', ['@PROJ-1-CA1']]] });
  assert.equal(code, 1);
  assert.match(out, /um teste com o ID dele falhou/);
});

test('um ID com marca de revisão humana ou de documento não exige teste', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'revisão humana'], ['PROJ-1-CA2', 'documento']]) };
  assert.equal(check({ files }).code, 0);
});

test('reprova o teste apagado que cobria o critério de outro ticket', () => {
  const files = {
    'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP']]),
    'PROJ-2': acceptanceFile([['PROJ-2-CA1', 'teste no Playwright']]),
  };
  const { code, out } = check({ files, vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(code, 1);
  assert.match(out, /PROJ-2-CA1 \(docs\/tickets\/PROJ-100\/PROJ-2\/aceite\.md\) não tem nenhum teste/);
});

test('lê só o aceite.md de cada pasta de ticket: os outros arquivos da pasta dos tickets não são aceite', () => {
  const extra = {
    'PROJ-100/PROJ-1/plano.msg': acceptanceFile([['PROJ-1-CA9', 'teste HTTP']]),
    'PROJ-100/PROJ-3/review.diff': acceptanceFile([['PROJ-3-CA1', 'teste HTTP']]),
    'PROJ-100/PROJ-4.md': acceptanceFile([['PROJ-4-CA1', 'teste HTTP']]),
    'PROJ-5/aceite.md': acceptanceFile([['PROJ-5-CA1', 'teste HTTP']]),
    // O trabalho sem ticket não tem aceite: a pasta `sem-ticket` não quebra a leitura.
    'sem-ticket/rascunho/review.diff': 'diff',
    'sem-ticket/vazio/.gitkeep': '',
  };
  const { code, out } = check({ files: TICKET, extra, vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(code, 0, out);
  assert.match(out, /1 critério\(s\) com teste/);
});

test('a pasta dos tickets é a do argumento: o caminho citado e as mensagens saem dela', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP']]) };
  const cited = check({ tickets: 'qa/tickets/', files, body: '## Aceite\n\nqa/tickets/PROJ-100/PROJ-1/aceite.md\n' });
  assert.equal(cited.code, 1);
  assert.match(cited.out, /PROJ-1-CA1 \(qa\/tickets\/PROJ-100\/PROJ-1\/aceite\.md\) não tem nenhum teste/);
  assert.doesNotMatch(cited.out, /que não existe/);

  const other = check({ tickets: 'qa/tickets', files, body: '## Aceite\n\ndocs/tickets/PROJ-100/PROJ-1/aceite.md\n' });
  assert.equal(other.code, 1);
  assert.match(other.out, /Escreva o caminho do arquivo \(qa\/tickets\/<issue>\/<ticket>\/aceite\.md\)/);
});

test('passa quando todos os IDs de teste estão cobertos por testes que passaram, no Vitest e no Playwright', () => {
  const files = {
    'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP'], ['PROJ-1-CA2', 'teste no Playwright']]),
  };
  const { code, out } = check({
    files,
    vitest: [['devolve 201', 'passed', ['@PROJ-1-CA1']]],
    playwright: [['o Usuário envia', 'passed', ['@PROJ-1-CA2']]],
  });
  assert.equal(code, 0, out);
  assert.match(out, /2 critério\(s\) com teste/);
});

test('o ID vale só na tag: com várias tags o teste cobre vários critérios, e o relatório do Playwright traz a tag com ou sem o @', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP'], ['PROJ-1-CA2', 'teste no Playwright']]) };
  const both = check({ files, vitest: [['devolve 201', 'passed', ['@PROJ-1-CA1', '@PROJ-1-CA2']]] });
  assert.equal(both.code, 0, both.out);
  assert.match(both.out, /2 critério\(s\) com teste/);

  const bare = check({ files, vitest: [['devolve 201', 'passed', ['@PROJ-1-CA1']]], playwright: [['envia', 'passed', ['PROJ-1-CA2']]] });
  assert.equal(bare.code, 0, bare.out);
});

test('o token no título não vale como ID: o teste sem tag reprova, e a mensagem manda mover o ID para uma tag', () => {
  const vitest = check({ files: TICKET, vitest: [['devolve 201 @PROJ-1-CA1', 'passed']] });
  assert.equal(vitest.code, 1);
  assert.match(vitest.out, /"devolve 201 @PROJ-1-CA1" tem @PROJ-1-CA1 no título e não nas tags/);
  assert.match(vitest.out, /Mova o ID para uma tag do teste/);
  // O critério também fica sem teste: o token no título não o cobre.
  assert.match(vitest.out, /PROJ-1-CA1 .*não tem nenhum teste/);

  const playwright = check({ files: TICKET, playwright: [['o Usuário envia @PROJ-1-CA1', 'passed']] });
  assert.equal(playwright.code, 1);
  assert.match(playwright.out, /tem @PROJ-1-CA1 no título e não nas tags/);

  // Com a tag, o token que sobrou no título não atrapalha.
  assert.equal(check({ files: TICKET, vitest: [['devolve 201 @PROJ-1-CA1', 'passed', ['@PROJ-1-CA1']]] }).code, 0);
});

test('o token no título que não está nas tags do teste reprova, com outra tag ou com a tag de outro ID', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste HTTP'], ['PROJ-1-CA2', 'teste HTTP']]) };
  const slow = check({ files, vitest: [['devolve 201 @PROJ-1-CA1', 'passed', ['slow']]] });
  assert.equal(slow.code, 1);
  assert.match(slow.out, /"devolve 201 @PROJ-1-CA1" tem @PROJ-1-CA1 no título e não nas tags/);
  assert.match(slow.out, /Mova o ID para uma tag do teste/);

  const other = check({ files, vitest: [['devolve 201 @PROJ-1-CA2', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(other.code, 1);
  assert.match(other.out, /tem @PROJ-1-CA2 no título e não nas tags/);

  // O token que está também nas tags passa; o que não tem a forma de um ID não conta.
  const same = check({ files, vitest: [['devolve 201 @PROJ-1-CA1 @PROJ-1-CA2', 'passed', ['slow', '@PROJ-1-CA1', 'PROJ-1-CA2']]] });
  assert.equal(same.code, 0, same.out);
  assert.equal(check({ files: TICKET, vitest: [['ok @foo-CA1 @PROJ-1', 'passed', ['@PROJ-1-CA1']]] }).code, 0);
});

test('o token no título é reportado junto com os outros erros, na mesma rodada', () => {
  const { code, out } = check({
    files: TICKET,
    body: '## Aceite\n\nnada.\n',
    vitest: [['devolve 201 @PROJ-1-CA1', 'passed', ['slow']], ['órfão', 'passed', ['@PROJ-9-CA3']]],
  });
  assert.equal(code, 1);
  assert.match(out, /não cita um arquivo de aceite/);
  assert.match(out, /PROJ-1-CA1 .*não tem nenhum teste/);
  assert.match(out, /tem @PROJ-1-CA1 no título e não nas tags/);
  assert.match(out, /@PROJ-9-CA3, que não está em nenhum arquivo de aceite/);
});

test('o teste com a tag de um ID que não existe, ou com a tag num teste pulado, reprova pelas mesmas regras', () => {
  const unknown = check({ files: TICKET, vitest: [['ok', 'passed', ['@PROJ-1-CA1']], ['órfão', 'passed', ['@PROJ-9-CA3']]] });
  assert.equal(unknown.code, 1);
  assert.match(unknown.out, /@PROJ-9-CA3, que não está em nenhum arquivo de aceite/);
  const skipped = check({ files: TICKET, vitest: [['pulado', 'pending', ['@PROJ-1-CA1']]] });
  assert.equal(skipped.code, 1);
  assert.match(skipped.out, /foi pulado/);
});

const PARSER_ACCEPTANCE = [
  '# Aceite do PROJ-901',
  '',
  'Introdução do aceite, com `código`.',
  '',
  'Segundo parágrafo da introdução.',
  '',
  '## PROJ-901-CA1',
  '',
  '### Contexto',
  '',
  '**Marca:** teste de unidade',
  '',
  '**Cenário:** Dado um parser, quando ele lê o arquivo,',
  'então devolve os critérios.',
  '',
  'Outro parágrafo do cenário.',
  '',
  '**Teste previsto:** testes do harness, `plan.test.cjs`, "lê o aceite @PROJ-901-CA1".',
  '',
  '## PROJ-901-CA2',
  '',
  '**Marca:** Documento.',
  '',
  '**Cenário:** Dado o LLD, quando se lê, então descreve a regra.',
  '',
].join('\n');

const PARSER_MESSAGE = [
  'docs: plan the parser (PROJ-901)',
  '',
  'Acceptance file docs/tickets/PROJ-900/PROJ-901/aceite.md (CA1-CA2).',
  '',
  'Decision: the parser lives in the skill, so the page and the checker',
  'read the same rules.',
  '',
  'A second paragraph of the same decision.',
  '',
  'Files and interfaces the implementation will touch:',
  '',
  '- plan.cjs: parseAcceptanceFile(name, text).',
  '- page.cjs: build(sources) -> HTML.',
  '',
  'Existing tests whose behavior changes: none.',
  '',
  'Data changes: none.',
  '',
  'Co-Authored-By: Someone <someone@example.com>',
  'Claude-Session: https://example.com/session',
  '',
].join('\n');

// O parser do aceite e da mensagem é o da skill de plano, que o conferidor importa. O esperado é o que
// o parser que morava no conferidor e na página do plano devolvia para as mesmas entradas, gravado
// antes de ele ir para a skill.
test('lê o aceite e a mensagem como o parser do conferidor, que o importa da skill', () => {
  assert.deepEqual(parseAcceptanceFile('PROJ-901.md', PARSER_ACCEPTANCE), {
    intro: 'Introdução do aceite, com `código`.\n\nSegundo parágrafo da introdução.',
    criteria: [
      {
        id: 'PROJ-901-CA1',
        file: 'PROJ-901.md',
        check: 'teste de unidade',
        scenario: 'Dado um parser, quando ele lê o arquivo,\nentão devolve os critérios.\n\nOutro parágrafo do cenário.',
        plannedTest: 'testes do harness, `plan.test.cjs`, "lê o aceite @PROJ-901-CA1".',
      },
      {
        id: 'PROJ-901-CA2',
        file: 'PROJ-901.md',
        check: 'documento',
        scenario: 'Dado o LLD, quando se lê, então descreve a regra.',
        plannedTest: null,
      },
    ],
  });

  assert.deepEqual(parseMessage(PARSER_MESSAGE), {
    text: PARSER_MESSAGE,
    subject: 'docs: plan the parser (PROJ-901)',
    decisions: [
      'the parser lives in the skill, so the page and the checker\nread the same rules.\n\nA second paragraph of the same decision.',
    ],
    files: '- plan.cjs: parseAcceptanceFile(name, text).\n- page.cjs: build(sources) -> HTML.',
    tests: 'none.',
    data: 'none.',
    visual: null,
  });
  assert.equal(parseMessage(null), null);
});

test('o conferidor importa o parser da pasta da skill de plano: aprova o critério cujo teste passou e reprova sem o teste', () => {
  assert.equal(require(CHECKER).parseAcceptanceFile, require(SKILL_PARSER).parseAcceptanceFile);
  assert.equal(require(CHECKER).CHECKS, require(SKILL_PARSER).CHECKS);

  // Uma cópia do conferidor só com o parser na pasta da skill: aprova com o teste que passou e
  // reprova pelo critério sem teste.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conferidor-'));
  const copy = path.join(root, 'scripts', 'check-acceptance.cjs');
  const parser = path.join(root, '.claude', 'skills', 'plan-ticket', 'scripts', 'plan.cjs');
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.mkdirSync(path.dirname(parser), { recursive: true });
  fs.copyFileSync(CHECKER, copy);
  fs.copyFileSync(SKILL_PARSER, parser);
  writeTickets(path.join(root, 'docs', 'tickets'), TICKET);
  const run = (tests) => {
    fs.writeFileSync(path.join(root, 'unit.json'), JSON.stringify(vitestReport(tests)));
    const result = spawnSync(process.execPath, [copy, '--required', '-', 'docs/tickets', `vitest:${path.join(root, 'unit.json')}`], {
      cwd: root,
      input: '## Aceite\n\ndocs/tickets/PROJ-100/PROJ-1/aceite.md\n',
      encoding: 'utf8',
    });
    return { code: result.status, out: result.stdout + result.stderr };
  };

  try {
    const approved = run([['devolve 201', 'passed', ['@PROJ-1-CA1']]]);
    assert.equal(approved.code, 0, approved.out);
    assert.match(approved.out, /PROJ-1-CA1: coberto por 1 teste/);

    const rejected = run([]);
    assert.equal(rejected.code, 1, rejected.out);
    assert.match(rejected.out, /PROJ-1-CA1 \(docs\/tickets\/PROJ-100\/PROJ-1\/aceite\.md\) não tem nenhum teste/);

    // Sem o parser na pasta da skill, o conferidor não roda: é de lá que ele o importa.
    fs.rmSync(parser);
    assert.notEqual(run([['devolve 201', 'passed', ['@PROJ-1-CA1']]]).code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reprova uma marca desconhecida no arquivo de aceite', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste manual']]) };
  const { code, out } = check({ files });
  assert.equal(code, 1);
  assert.match(out, /marca "teste manual" desconhecida/);
});

test('reprova o PR que altera apps/ sem a seção Aceite', () => {
  const { code, out } = check({ body: '## Resumo\n\ntexto\n' });
  assert.equal(code, 1);
  assert.match(out, /não tem a seção "Aceite"/);
});

test('passa o PR com "nenhum" e o motivo, e reprova "nenhum" sem motivo', () => {
  assert.equal(check({ body: '## Aceite\n\nNenhum: refatoração sem mudança de comportamento.\n' }).code, 0);
  const { code, out } = check({ body: '## Aceite\n\nnenhum\n' });
  assert.equal(code, 1);
  assert.match(out, /"nenhum" com o motivo/);
});

test('passa o PR que cita um arquivo de aceite existente e reprova o que cita um inexistente', () => {
  const ok = check({
    body: '## Aceite\n\n`docs/tickets/PROJ-100/PROJ-1/aceite.md`\n',
    files: { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'revisão humana']]) },
  });
  assert.equal(ok.code, 0, ok.out);
  const missing = check({ body: '## Aceite\n\ndocs/tickets/PROJ-100/PROJ-7/aceite.md\n' });
  assert.equal(missing.code, 1);
  assert.match(missing.out, /docs\/tickets\/PROJ-100\/PROJ-7\/aceite\.md, que não existe/);
});

test('reprova o PR que cita o caminho antigo do aceite, apontando o caminho novo na pasta do ticket', () => {
  const { code, out } = check({
    body: '## Aceite\n\n`docs/aceite/PROJ-1.md`\n',
    files: { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'revisão humana']]) },
  });
  assert.equal(code, 1);
  assert.match(out, /cita docs\/aceite\/PROJ-1\.md, o caminho antigo/);
  assert.match(out, /Cite docs\/tickets\/<issue>\/PROJ-1\/aceite\.md/);
  assert.doesNotMatch(out, /não cita/);
});

test('reprova o PR que cita o caminho de um nível, sem a pasta da issue pai, apontando o caminho novo', () => {
  const { code, out } = check({
    body: '## Aceite\n\n`docs/tickets/PROJ-1/aceite.md`\n',
    files: { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'revisão humana']]) },
  });
  assert.equal(code, 1);
  assert.match(out, /cita docs\/tickets\/PROJ-1\/aceite\.md, o caminho antigo/);
  assert.match(out, /Cite docs\/tickets\/<issue>\/PROJ-1\/aceite\.md/);
  assert.doesNotMatch(out, /não cita/);
});

test('sem a seção Aceite, o PR que não altera apps/ passa, mas a cobertura continua conferida', () => {
  assert.equal(check({ mode: '--optional', body: 'só documento' }).code, 0);
  assert.equal(check({ mode: '--optional', body: 'só documento', files: TICKET }).code, 1);
});

test('o ID num describe não cobre os testes de dentro dele, e a tag do Playwright vale com ou sem o @', () => {
  const report = vitestReport([['um teste sem relação', 'passed']]);
  report.testResults[0].assertionResults[0].fullName = '@PROJ-1-CA1 grupo um teste sem relação';
  report.testResults[0].assertionResults[0].ancestorTitles = ['@PROJ-1-CA1 grupo'];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aceite-'));
  writeTickets(path.join(dir, 'docs', 'tickets'), TICKET);
  fs.writeFileSync(path.join(dir, 'unit.json'), JSON.stringify(report));
  const run = () =>
    spawnSync(process.execPath, [CHECKER, '--required', '-', 'docs/tickets', `vitest:${path.join(dir, 'unit.json')}`], {
      cwd: dir,
      input: '## Aceite\n\nnenhum: teste.\n',
      encoding: 'utf8',
    });
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /PROJ-1-CA1 .*não tem nenhum teste/);
  assert.equal(check({ files: TICKET, playwright: [['o Usuário envia', 'passed', ['PROJ-1-CA1']]] }).code, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('aceita título de critério com texto depois do ID, marca com ponto final e "nenhum" em negrito', () => {
  const files = { 'PROJ-1': '## PROJ-1-CA1 · Bloqueio na sexta tentativa\n\n- **Marca:** Teste HTTP.\n' };
  const { code, out } = check({ files, body: '## Aceite\n\n**nenhum**: refatoração.\n', vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(code, 0, out);
});

test('um subtítulo dentro do critério não o encerra: a marca depois dele ainda é lida, e a introdução é só o texto antes do primeiro critério', () => {
  const text = [
    '# Aceite do PROJ-1',
    '',
    'Introdução.',
    '',
    '## PROJ-1-CA1',
    '',
    '### Contexto',
    '',
    '**Marca:** teste HTTP',
    '',
    '**Cenário:** Dado, Quando, Então.',
    '',
    '### Observação',
    '',
    'Texto do subtítulo, fora do cenário.',
    '',
    '**Teste previsto:** `x.e2e-spec.ts`.',
    '',
    '## PROJ-1-CA2',
    '',
    '**Marca:** documento',
    '',
  ].join('\n');

  const { intro, criteria } = parseAcceptanceFile('PROJ-1.md', text);
  assert.equal(intro, 'Introdução.');
  assert.deepEqual(
    criteria.map(({ id, check, scenario, plannedTest }) => ({ id, check, scenario, plannedTest })),
    [
      { id: 'PROJ-1-CA1', check: 'teste http', scenario: 'Dado, Quando, Então.', plannedTest: '`x.e2e-spec.ts`.' },
      { id: 'PROJ-1-CA2', check: 'documento', scenario: null, plannedTest: null },
    ],
  );

  // O conferidor que bloqueia lê a mesma marca: o critério exige teste, e não sai como marca ausente.
  const files = { 'PROJ-1': text };
  const missing = check({ files });
  assert.equal(missing.code, 1);
  assert.match(missing.out, /PROJ-1-CA1 \(docs\/tickets\/PROJ-100\/PROJ-1\/aceite\.md\) não tem nenhum teste/);
  assert.doesNotMatch(missing.out, /marca "ausente"/);
  const covered = check({ files, vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(covered.code, 0, covered.out);
});

test('sem corpo de PR, a entrada vazia, o modo opcional confere só a cobertura, e o obrigatório reprova pela falta da seção', () => {
  const optional = check({ mode: '--optional', body: '', files: TICKET, vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(optional.code, 0, optional.out);
  assert.match(optional.out, /seção não exigida/);

  const required = check({ body: '', files: TICKET, vitest: [['ok', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(required.code, 1);
  assert.match(required.out, /não tem a seção "Aceite"/);
});

test('recebe o corpo do PR só pela entrada padrão: um caminho no lugar do `-` é recusado', () => {
  for (const args of [
    ['--required', 'corpo.md', '/nao/existe', 'vitest:/x.json'],
    ['--cited', 'corpo.md', 'docs/tickets'],
  ]) {
    const result = spawnSync(process.execPath, [CHECKER, ...args], { input: '', encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Uso: node check-acceptance\.cjs/);
  }
});

test('reprova o relatório ausente em vez de aprovar sem conferir', () => {
  const result = spawnSync(process.execPath, [CHECKER, '--optional', '-', '/nao/existe', 'vitest:/x.json'], {
    input: '',
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
});

test('no modo --cited, imprime só o arquivo de aceite citado na seção do corpo da entrada padrão, e nada sem ele', () => {
  // O corpo chega pela entrada padrão, com `-`; sem corpo, a entrada vem vazia.
  const cited = (body) => {
    const result = spawnSync(process.execPath, [CHECKER, '--cited', '-', 'docs/tickets'], { input: body ?? '', encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };

  assert.equal(cited('Resumo.\n\n## Aceite\n\ndocs/tickets/PROJ-100/PROJ-2/aceite.md\n\n## Testes\n'), 'docs/tickets/PROJ-100/PROJ-2/aceite.md\n');
  // A quebra de linha do GitHub e o caminho entre crases.
  assert.equal(cited('## Aceite\r\n\r\n`docs/tickets/PROJ-100/PROJ-2/aceite.md`\r\n'), 'docs/tickets/PROJ-100/PROJ-2/aceite.md\n');
  // O arquivo citado fora da seção não conta.
  assert.equal(cited('Ver docs/tickets/PROJ-100/PROJ-2/aceite.md.\n\n## Aceite\n\nnenhum: só documento.\n'), '');
  assert.equal(cited('## Aceite\n\nnenhum: refatoração sem mudança de comportamento.\n'), '');
  assert.equal(cited('Resumo sem a seção, citando docs/tickets/PROJ-100/PROJ-2/aceite.md.\n'), '');
  // Os caminhos antigos, de antes da pasta do ticket e de antes da pasta da issue pai, não são citados.
  for (const old of ['docs/aceite/PROJ-2.md', 'docs/tickets/PROJ-2/aceite.md']) {
    const result = spawnSync(process.execPath, [CHECKER, '--cited', '-', 'docs/tickets'], {
      input: `## Aceite\n\n${old}\n`,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, old);
    assert.equal(result.stderr.includes('Aceite: 1 problema(s)'), true);
    assert.match(result.stdout, /docs\/tickets\/<issue>\/PROJ-2\/aceite\.md/);
    assert.match(result.stdout, /o caminho antigo/);
  }
  // Sem corpo de PR.
  assert.equal(cited(null), '');
});

test('confere o relatório da suíte de unidade da web: aceita o teste que passou e recusa o que falhou', () => {
  // O relatório da web chega ao conferidor como `vitest:`, como o da API: o ID na tag é a ligação.
  const unit = (status) => [['o login volta para a página pedida', status, ['@PROJ-1-CA1']]];
  const passed = check({ files: TICKET, vitest: unit('passed') });
  assert.equal(passed.code, 0, passed.out);
  assert.match(passed.out, /PROJ-1-CA1: coberto por 1 teste\(s\)/);

  const failed = check({ files: TICKET, vitest: unit('failed') });
  assert.equal(failed.code, 1);
  assert.match(failed.out, /PROJ-1-CA1: um teste com o ID dele falhou/);
});

test('aceita a marca teste de integração e exige o teste com o ID que rodou e passou', () => {
  const files = { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste de integração']]) };

  const none = check({ files });
  assert.equal(none.code, 1);
  assert.match(none.out, /PROJ-1-CA1 \(docs\/tickets\/PROJ-100\/PROJ-1\/aceite\.md\) não tem nenhum teste/);

  const failed = check({ files, vitest: [['grava', 'failed', ['@PROJ-1-CA1']]] });
  assert.equal(failed.code, 1);
  assert.match(failed.out, /falhou/);

  const skipped = check({ files, vitest: [['grava', 'pending', ['@PROJ-1-CA1']]] });
  assert.equal(skipped.code, 1);
  assert.match(skipped.out, /foi pulado/);

  const passed = check({ files, vitest: [['grava', 'passed', ['@PROJ-1-CA1']]] });
  assert.equal(passed.code, 0, passed.out);
  assert.match(passed.out, /1 critério\(s\) com teste/);

  // A marca "teste manual" continua recusada, e a mensagem lista as seis marcas.
  const manual = check({ files: { 'PROJ-1': acceptanceFile([['PROJ-1-CA1', 'teste manual']]) } });
  assert.equal(manual.code, 1);
  assert.match(manual.out, /marca "teste manual" desconhecida/);
  assert.match(manual.out, /teste HTTP, teste no Playwright, teste de unidade, teste de integração, revisão humana ou documento/);
});
