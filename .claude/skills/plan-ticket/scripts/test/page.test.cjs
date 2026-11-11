// Testes da página de revisão do plano, pela interface que o script da página usa: as fontes do
// plano na entrada (o arquivo de aceite, o Markdown do contrato, o diff dos documentos e a mensagem
// proposta) e o HTML na saída. Rodam com o runner nativo do Node (`node --test`), sem dependências.
// Nenhum título cita o ID de um critério de aceite: os testes de aceite de um projeto ficam nos
// testes dele.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { build } = require('../page.cjs');
const { panel, text } = require('./helpers.cjs');

const ORIGIN = 'Montada da pasta de trabalho.';

const ACCEPTANCE = [
  '# Aceite do PROJ-123',
  '',
  'Ticket de exemplo.',
  '',
  '## PROJ-123-CA1',
  '',
  '**Marca:** documento',
  '',
  '**Cenário:** Dado o LLD, quando se lê a seção de cópia, então ela descreve a cota.',
  '',
].join('\n');

test('fecha o negrito que contém um asterisco solto', () => {
  const acceptance = ACCEPTANCE.replace('Ticket de exemplo.', 'Ticket de exemplo.\n\n**Nota: 2*3 = 6.** resto');
  const aceite = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, acceptance }), 'aceite');
  assert.match(aceite, /<p><strong>Nota: 2\*3 = 6\.<\/strong> resto<\/p>/);
});

test('sem o arquivo de aceite, a aba Aceite cita o caminho dele no projeto', () => {
  const html = build({ ticket: 'PROJ-123', origin: ORIGIN, acceptancePath: 'qa/criterios/PROJ-123.md' });
  assert.match(panel(html, 'aceite'), /O plano não tem o arquivo de aceite <code>qa\/criterios\/PROJ-123\.md<\/code>\./);
});

test('separa o diff dos documentos pelo caminho de cada arquivo, com acento, espaço, aspas, apagado e binário', () => {
  const docsDiff = [
    'diff --git a/docs/decisões.md b/docs/decisões.md',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/docs/decisões.md',
    '@@ -0,0 +1 @@',
    '+Nova decisão.',
    'diff --git a/docs/notas de b/ reunião.md b/docs/notas de b/ reunião.md',
    'index 1111111..2222222 100644',
    '--- a/docs/notas de b/ reunião.md\t',
    '+++ b/docs/notas de b/ reunião.md\t',
    '@@ -1 +1 @@',
    '-Antes.',
    '+Depois.',
    'diff --git a/docs/velho.md b/docs/velho.md',
    'deleted file mode 100644',
    'index 3333333..0000000',
    '--- a/docs/velho.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-Some.',
    'diff --git a/docs/figura nova.png b/docs/figura nova.png',
    'new file mode 100644',
    'index 0000000..4444444',
    'Binary files /dev/null and b/docs/figura nova.png differ',
    'diff --git "a/docs/com \\"aspas\\".md" "b/docs/com \\"aspas\\".md"',
    'index 5555555..6666666 100644',
    '--- "a/docs/com \\"aspas\\".md"',
    '+++ "b/docs/com \\"aspas\\".md"',
    '@@ -1 +1 @@',
    '-a',
    '+b',
    'diff --git "a/docs/\\303\\241rvore.md" "b/docs/\\303\\241rvore.md"',
    'index 7777777..8888888 100644',
    '--- "a/docs/\\303\\241rvore.md"',
    '+++ "b/docs/\\303\\241rvore.md"',
    '@@ -1 +1 @@',
    '-c',
    '+d',
    '',
  ].join('\n');

  const documentos = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, docsDiff }), 'documentos');
  const files = [...documentos.matchAll(/<h2><code>([^<]*)<\/code><\/h2>/g)].map((match) => text(match[1]));
  assert.deepEqual(files, [
    'docs/decisões.md',
    'docs/notas de b/ reunião.md',
    'docs/velho.md',
    'docs/figura nova.png',
    'docs/com "aspas".md',
    'docs/árvore.md',
  ]);
  assert.match(text(documentos), /\+Nova decisão\./);
});

test('dentro de um trecho, a linha que parece cabeçalho é uma linha removida ou acrescentada', () => {
  const docsDiff = [
    'diff --git a/docs/lld.md b/docs/lld.md',
    'index 3333333..4444444 100644',
    '--- a/docs/lld.md',
    '+++ b/docs/lld.md',
    '@@ -1,3 +1,3 @@',
    ' # LLD',
    '--- item que sai',
    '+++ item que entra',
    '',
  ].join('\n');

  const documentos = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, docsDiff }), 'documentos');
  assert.match(documentos, /<span class="meta">--- a\/docs\/lld\.md<\/span>/);
  assert.match(documentos, /<span class="meta">\+\+\+ b\/docs\/lld\.md<\/span>/);
  assert.match(documentos, /<span class="menos">--- item que sai<\/span>/);
  assert.match(documentos, /<span class="mais">\+\+\+ item que entra<\/span>/);
});

test('lê cada bloco da mensagem do rótulo até o próximo rótulo ou as linhas de atribuição', () => {
  const message = [
    'docs: plan the item copy (PROJ-123)',
    '',
    'Acceptance file docs/tickets/PROJ-1/PROJ-123/aceite.md (CA1-CA2).',
    '',
    'Decision: the copy reserves quota before writing.',
    '',
    'A second paragraph of the same decision, about the Disk.',
    '',
    'Decision: the copy keeps the name.',
    '',
    'Files and interfaces the implementation will touch:',
    '',
    '- apps/api/src/items/copy.service.ts: copy(itemId, parentId) -> Item.',
    '- apps/api/test/items.e2e-spec.ts (CA1).',
    '',
    'Existing tests whose behavior changes: none.',
    '',
    'Data changes: none.',
    '',
    'Co-Authored-By: Someone <someone@example.com>',
    'Claude-Session: https://example.com/session',
    '',
  ].join('\n');

  const html = build({ ticket: 'PROJ-123', origin: ORIGIN, message });
  const decisions = panel(html, 'decisoes');
  const items = [...decisions.matchAll(/<ol class="decisoes">([\s\S]*?)<\/ol>/g)][0][1].match(/<li>[\s\S]*?<\/li>/g);
  assert.equal(items.length, 2, decisions);
  assert.match(items[0], /<p>the copy reserves quota before writing\.<\/p>\n<p>A second paragraph of the same decision, about the Disk\.<\/p>/);
  assert.equal(text(items[1]), 'the copy keeps the name.');
  assert.doesNotMatch(text(items[1]), /Files and interfaces/);

  const arquivos = panel(html, 'arquivos');
  assert.match(arquivos, /<ul><li>apps\/api\/src\/items\/copy\.service\.ts: copy\(itemId, parentId\) -&gt; Item\.<\/li><li>apps\/api\/test\/items\.e2e-spec\.ts \(CA1\)\.<\/li><\/ul>/);
  assert.match(text(arquivos), /Testes existentes cujo comportamento muda none\./);
  assert.match(text(arquivos), /Mudança de dados none\. *Referência visual/);
  assert.doesNotMatch(text(arquivos), /Co-Authored-By|Claude-Session/);
});

test('a referência visual é opcional: sem o bloco, a aba diz que não há, e não que falta', () => {
  const without = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, message: 'docs: plan (PROJ-123)\n\nData changes: none.\n' }), 'arquivos');
  assert.match(text(without), /Referência visual Nenhuma: o plano não cita telas de protótipo\./);
  assert.doesNotMatch(without, /Visual reference:/);

  const message = 'docs: plan (PROJ-123)\n\nVisual reference: JulianoRamos/finance-prototipo@a1b2c3d.\n\n- Lancamentos: o formulário.\n';
  const withRef = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, message }), 'arquivos');
  assert.match(withRef, /<h2>Referência visual<\/h2>\n<p>JulianoRamos\/finance-prototipo@a1b2c3d\.<\/p>/);
  assert.match(withRef, /<li>Lancamentos: o formulário\.<\/li>/);
});

test('avisa no topo da página das mudanças fora do índice nos caminhos do plano, e não avisa sem elas', () => {
  const html = build({ ticket: 'PROJ-123', origin: ORIGIN, pending: [' M docs/lld.md', '?? docs/<novo>.md'] });
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));
  assert.match(header, /<div class="aviso" role="alert">/);
  assert.match(text(header), /Há mudanças fora do índice nos caminhos do plano\./);
  assert.match(header, /<li><code> M docs\/lld\.md<\/code><\/li><li><code>\?\? docs\/&lt;novo&gt;\.md<\/code><\/li>/);

  assert.doesNotMatch(build({ ticket: 'PROJ-123', origin: ORIGIN }), /class="aviso"/);
});

test('a lista acaba num título, numa cerca, numa linha de tabela ou numa linha em branco, e a linha comum continua o item', () => {
  const contract = [
    '# Contrato',
    '',
    '- primeiro',
    'continuação do primeiro',
    '## Depois da lista',
    '- segundo',
    '```text',
    'código',
    '```',
    '- terceiro',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '- quarto',
    '',
    'Parágrafo.',
    '',
  ].join('\n');

  const tab = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, contract }), 'contrato');
  assert.match(tab, /<ul><li>primeiro continuação do primeiro<\/li><\/ul>\n<h2>Depois da lista<\/h2>/);
  assert.match(tab, /<ul><li>segundo<\/li><\/ul>\n<pre>código<\/pre>/);
  assert.match(tab, /<ul><li>terceiro<\/li><\/ul>\n<div class="rolagem"><table><thead><tr><th>A<\/th><th>B<\/th>/);
  assert.match(tab, /<ul><li>quarto<\/li><\/ul>\n<p>Parágrafo\.<\/p>/);
});

test('dentro de um bloco de código, só uma cerca sem nada o fecha, nas seções do contrato e no Markdown', () => {
  const contract = [
    '# Contrato',
    '',
    '```text',
    '```diff',
    '# Schema',
    '```',
    '',
    'Depois do bloco.',
    '',
    '# Schema',
    '',
    '*O schema não muda.*',
    '',
  ].join('\n');

  const html = build({ ticket: 'PROJ-123', origin: ORIGIN, contract });
  assert.match(panel(html, 'contrato'), /<pre>```diff\n# Schema<\/pre>\n<p>Depois do bloco\.<\/p>/);
  assert.equal(text(panel(html, 'schema')), 'O schema não muda.');
  assert.match(panel(html, 'schema'), /<p class="vazio">O schema não muda\.<\/p>/);
});

test('só o parágrafo que é um único trecho em itálico, sem asterisco dentro, é uma nota de vazio', () => {
  const contract = ['# Contrato', '', '*a* e *b*', '', '*nota com `código`*', '', '*um **forte** aqui*', ''].join('\n');

  const tab = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, contract }), 'contrato');
  assert.match(tab, /<p>\*a\* e \*b\*<\/p>/);
  assert.match(tab, /<p class="vazio">nota com <code>código<\/code><\/p>/);
  assert.match(tab, /<p>\*um <strong>forte<\/strong> aqui\*<\/p>/);
  assert.equal((tab.match(/class="vazio"/g) ?? []).length, 1, tab);
});

test('tira do título só a sequência de fechamento com um espaço antes', () => {
  const contract = ['# Contrato', '', '## Rotas ##', '', '### Linguagem x-c#', '', '#### C# #', '', '##### #', ''].join('\n');

  const tab = panel(build({ ticket: 'PROJ-123', origin: ORIGIN, contract }), 'contrato');
  assert.match(tab, /<h2>Rotas<\/h2>/);
  assert.match(tab, /<h3>Linguagem x-c#<\/h3>/);
  assert.match(tab, /<h4>C#<\/h4>/);
  assert.match(tab, /<h5><\/h5>/);
});

test('a linha de comando lê as fontes em pares terminados por NUL na entrada padrão, com `-`, e imprime a página', () => {
  const cli = (args, input) =>
    spawnSync(process.execPath, [path.join(__dirname, '..', 'page.cjs'), ...args], { input, encoding: 'utf8' });
  // Como o `printf '%s\0' <nome> <valor>...` do plan-page.sh: só as fontes que existem, sem o contrato.
  const pairs = (sources) => Object.entries(sources).flat().map((part) => `${part}\0`).join('');
  const sources = {
    ticket: 'PROJ-123',
    origin: ORIGIN,
    acceptancePath: 'docs/tickets/PROJ-1/PROJ-123/aceite.md',
    acceptance: ACCEPTANCE,
    docsDiff: '',
    message: 'docs: plan (PROJ-123)\n\nDecision: a cópia reserva a cota.\n',
    pending: ' M docs/lld.md\n?? docs/tickets/PROJ-1/PROJ-124/aceite.md',
  };

  const result = cli(['-'], pairs(sources));
  assert.equal(result.status, 0, result.stderr);
  const { pending, ...rest } = sources;
  assert.equal(result.stdout, build({ ...rest, pending: pending.split('\n') }));
  assert.match(text(panel(result.stdout, 'aceite')), /PROJ-123-CA1 documento Dado o LLD/);
  assert.match(result.stdout, /<li><code> M docs\/lld\.md<\/code><\/li><li><code>\?\? docs\/tickets\/PROJ-1\/PROJ-124\/aceite\.md<\/code><\/li>/);
  assert.match(text(panel(result.stdout, 'contrato')), /^O projeto não declara contrato\.$/);

  // Uma entrada que não termina num par completo é recusada.
  const broken = cli(['-'], 'ticket\0PROJ-123');
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /pares nome e valor/);

  // Sem o `-`, ou com uma pasta, a linha de comando diz como chamá-la.
  for (const args of [[], ['fontes']]) {
    const wrong = cli(args, '');
    assert.equal(wrong.status, 2);
    assert.match(wrong.stderr, /Uso: node page\.cjs -/);
  }
});
