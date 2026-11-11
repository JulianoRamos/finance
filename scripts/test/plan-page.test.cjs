// Testes de aceite da skill de plano neste projeto: a página de revisão do plano, pelo construtor da
// skill (.claude/skills/plan-ticket/scripts/page.cjs), com as fontes de um plano de exemplo na entrada
// e o HTML na saída. Ficam aqui, e não na pasta da skill, porque citam os IDs dos critérios deste
// projeto. Rodam com o runner nativo do Node, dentro do contêiner `harness`.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { build } = require('../../.claude/skills/plan-ticket/scripts/page.cjs');
const { parseAcceptanceFile } = require('../../.claude/skills/plan-ticket/scripts/plan.cjs');
const { panel, text } = require('./helpers.cjs');

const ORIGIN = 'Montada da pasta de trabalho.';

const ACCEPTANCE = [
  '# Aceite do PROJ-900',
  '',
  'Ticket de exemplo.',
  '',
  '## PROJ-900-CA1',
  '',
  '**Marca:** teste HTTP',
  '',
  '**Cenário:** Dado um item, quando o Usuário o copia, então a cópia é criada.',
  '',
  '**Teste previsto:** testes de ponta a ponta da API, `items.e2e-spec.ts`, "copia o item @PROJ-900-CA1".',
  '',
  '## PROJ-900-CA2',
  '',
  '**Marca:** documento',
  '',
  '**Cenário:** Dado o LLD, quando se lê a seção de cópia, então ela descreve a cota.',
  '',
].join('\n');

test('mostra cada ID com a marca e o cenário, e o teste previsto ao expandir, lidos pelo parser do conferidor', () => {
  // O parser do conferidor do aceite é o da skill (plan.cjs), que o conferidor importa.
  const { intro, criteria } = parseAcceptanceFile('PROJ-900.md', ACCEPTANCE);

  assert.equal(intro, 'Ticket de exemplo.');
  assert.deepEqual(criteria, [
    {
      id: 'PROJ-900-CA1',
      file: 'PROJ-900.md',
      check: 'teste http',
      scenario: 'Dado um item, quando o Usuário o copia, então a cópia é criada.',
      plannedTest: 'testes de ponta a ponta da API, `items.e2e-spec.ts`, "copia o item @PROJ-900-CA1".',
    },
    {
      id: 'PROJ-900-CA2',
      file: 'PROJ-900.md',
      check: 'documento',
      scenario: 'Dado o LLD, quando se lê a seção de cópia, então ela descreve a cota.',
      plannedTest: null,
    },
  ]);

  const aceite = panel(build({ ticket: 'PROJ-900', origin: 'Montada da pasta de trabalho.', acceptance: ACCEPTANCE }), 'aceite');
  const rows = aceite.match(/<tr class="criterio"[\s\S]*?<\/tr>/g) ?? [];
  assert.equal(rows.length, 2, aceite);

  const [first, second] = rows;
  assert.match(text(first), /^PROJ-900-CA1 teste HTTP Dado um item, quando o Usuário o copia, então a cópia é criada\./);
  assert.match(first, /<details><summary>Teste previsto<\/summary>[\s\S]*items\.e2e-spec\.ts[\s\S]*copia o item @PROJ-900-CA1[\s\S]*<\/details>/);
  assert.match(text(second), /^PROJ-900-CA2 documento Dado o LLD, quando se lê a seção de cópia, então ela descreve a cota\.$/);
  assert.doesNotMatch(second, /<details/);
});

test('mostra em negrito o trecho que contém código, sem sobrar asteriscos', () => {
  const acceptance = ACCEPTANCE.replace(
    'Ticket de exemplo.',
    'Ticket de exemplo.\n\n**Como o teste faz o `GET` da URL.** O resto do parágrafo.',
  ).replace('então a cópia é criada.', 'então a cópia é criada. **Atenção:** use `node:http`');

  const aceite = panel(build({ ticket: 'PROJ-900', origin: 'Montada da pasta de trabalho.', acceptance }), 'aceite');
  assert.match(aceite, /<p><strong>Como o teste faz o <code>GET<\/code> da URL\.<\/strong> O resto do parágrafo\.<\/p>/);
  assert.match(aceite, /então a cópia é criada\. <strong>Atenção:<\/strong> use <code>node:http<\/code><\/p>/);
  assert.doesNotMatch(aceite, /\*\*/);

  // Um `**` sem par continua como texto, e o código continua escapado.
  const unpaired = ACCEPTANCE.replace('quando se lê a seção de cópia', 'quando se lê 2 ** 3 em `<b>**</b>`');
  assert.match(
    panel(build({ ticket: 'PROJ-900', origin: 'Montada da pasta de trabalho.', acceptance: unpaired }), 'aceite'),
    /quando se lê 2 \*\* 3 em <code>&lt;b&gt;\*\*&lt;\/b&gt;<\/code>, então ela descreve a cota\./,
  );
});

test('monta a aba Contrato do Markdown recebido, ou diz que o projeto não declara contrato', () => {
  const contract = [
    '# Contrato',
    '',
    '## Rotas novas <i>',
    '',
    '| Nome | Tipo | Nota |',
    '| --- | --- | --- |',
    '| `sort` | string ("name" \\| "size") | <b>forte</b> |',
    '| `id` | string |  |',
    '',
    '- primeiro item',
    '  - item aninhado com `código`',
    '- segundo item',
    '',
    '```text',
    'GET /v1/x <script>alert(1)</script>',
    '  linha recuada',
    '```',
    '',
  ].join('\n');

  const tab = panel(build({ ticket: 'PROJ-900', origin: ORIGIN, contract }), 'contrato');

  assert.match(tab, /<h2>Rotas novas &lt;i&gt;<\/h2>/);
  assert.match(tab, /<thead><tr><th>Nome<\/th><th>Tipo<\/th><th>Nota<\/th><\/tr><\/thead>/);
  assert.match(
    tab,
    /<tr><td><code>sort<\/code><\/td><td>string \(&quot;name&quot; \| &quot;size&quot;\)<\/td><td>&lt;b&gt;forte&lt;\/b&gt;<\/td><\/tr>/,
  );
  assert.match(tab, /<tr><td><code>id<\/code><\/td><td>string<\/td><td><\/td><\/tr>/);
  assert.match(tab, /<ul><li>primeiro item<ul><li>item aninhado com <code>código<\/code><\/li><\/ul><\/li><li>segundo item<\/li><\/ul>/);
  assert.match(tab, /<pre>GET \/v1\/x &lt;script&gt;alert\(1\)&lt;\/script&gt;\n {2}linha recuada<\/pre>/);
  assert.doesNotMatch(tab, /<script|<b>|<i>/);
  // A seção `# Contrato` vira a aba, e não um título dentro dela.
  assert.doesNotMatch(tab, /<h1>/);

  const none = build({ ticket: 'PROJ-900', origin: ORIGIN, contract: null });
  assert.equal(text(panel(none, 'contrato')), 'O projeto não declara contrato.');
  assert.equal(text(panel(none, 'schema')), 'O projeto não declara contrato.');
});

const SCHEMA_DIFF = [
  'diff --git a/apps/api/prisma/schema.prisma b/apps/api/prisma/schema.prisma',
  'index 1111111..2222222 100644',
  '--- a/apps/api/prisma/schema.prisma',
  '+++ b/apps/api/prisma/schema.prisma',
  '@@ -10,6 +10,8 @@ model Item {',
  '   name      String',
  '+  /// A cópia de onde o item saiu.',
  '+  copiedFrom String? @map("copied_from") @db.Uuid',
  '',
].join('\n');

const DOCS_DIFF = [
  'diff --git a/docs/lld.md b/docs/lld.md',
  'index 3333333..4444444 100644',
  '--- a/docs/lld.md',
  '+++ b/docs/lld.md',
  '@@ -1,3 +1,3 @@',
  ' # LLD',
  '-A cópia não existe.',
  '+A cópia reserva cota antes de gravar.',
  '',
].join('\n');

const MESSAGE = [
  'docs: plan the item copy (PROJ-900)',
  '',
  'Acceptance file docs/tickets/PROJ-899/PROJ-900/aceite.md (CA1-CA2).',
  '',
  'Decision: the copy reserves quota before writing, so a full Disk fails early.',
  '',
  'Files and interfaces the implementation will touch:',
  '- apps/api/src/items/copy.service.ts: copy(itemId, parentId) -> Item.',
  '- apps/api/test/items.e2e-spec.ts (CA1).',
  '',
  'Data changes: none.',
  '',
].join('\n');

// O Markdown do contrato, no formato de formatos/contrato.md: uma rota nova e o diff do schema.
const CONTRACT = [
  'Contrato e schema de HEAD para o índice.',
  '',
  '# Contrato',
  '',
  '## O que mudou no contrato',
  '',
  '```text',
  'endpoint added POST /v1/items/{id}/copies',
  '```',
  '',
  '### Rota nova · POST /v1/items/{id}/copies · protegida (bearer)',
  '',
  '#### Parâmetros',
  '',
  '| Nome | Onde | Tipo | Obrigatório | Limites |',
  '| --- | --- | --- | --- | --- |',
  '| `id` | caminho | string | sim |  |',
  '',
  '# Schema',
  '',
  '```diff',
  SCHEMA_DIFF.replace(/\n$/, ''),
  '```',
  '',
].join('\n');

const SOURCES = {
  ticket: 'PROJ-900',
  origin: 'Montada da pasta de trabalho.',
  acceptance: ACCEPTANCE.replace('quando o Usuário o copia', 'quando o Usuário o copia com o nome <script>alert(1)</script>'),
  contract: CONTRACT,
  docsDiff: DOCS_DIFF,
  message: MESSAGE,
};

test('monta a página com as seis abas, cada uma com o conteúdo da sua fonte', () => {
  const html = build(SOURCES);

  // As seis abas, nesta ordem, cada uma com o seu painel.
  const labels = [...html.matchAll(/<label for="tab-([a-z]+)">([^<]+)<\/label>/g)];
  assert.deepEqual(
    labels.map((match) => match[2]),
    ['Aceite', 'Contrato', 'Schema', 'Documentos', 'Arquivos e interfaces', 'Decisões'],
  );
  const ids = labels.map((match) => match[1]);
  assert.deepEqual(ids, ['aceite', 'contrato', 'schema', 'documentos', 'arquivos', 'decisoes']);

  // Cada aba traz o conteúdo da sua fonte.
  const aceite = text(panel(html, 'aceite'));
  assert.match(aceite, /PROJ-900-CA1/);
  assert.match(aceite, /PROJ-900-CA2/);
  const contrato = text(panel(html, 'contrato'));
  assert.match(contrato, /endpoint added POST \/v1\/items\/\{id\}\/copies/);
  assert.match(contrato, /Rota nova · POST \/v1\/items\/\{id\}\/copies · protegida \(bearer\)/);
  assert.match(panel(html, 'schema'), /<span class="mais">\+ {2}copiedFrom String\? @map\(&quot;copied_from&quot;\) @db\.Uuid<\/span>/);
  const documentos = panel(html, 'documentos');
  assert.match(documentos, /<h2><code>docs\/lld\.md<\/code><\/h2>/);
  assert.match(text(documentos), /\+A cópia reserva cota antes de gravar\./);
  const arquivos = panel(html, 'arquivos');
  assert.match(arquivos, /<li>apps\/api\/src\/items\/copy\.service\.ts: copy\(itemId, parentId\) -&gt; Item\.<\/li>/);
  assert.match(text(arquivos), /apps\/api\/test\/items\.e2e-spec\.ts \(CA1\)/);
  assert.match(text(arquivos), /Mudança de dados none\./);
  // O bloco que a mensagem não tem aparece como ausente, sem quebrar a página.
  assert.match(text(arquivos), /Ausente na mensagem proposta: falta o bloco Existing tests whose behavior changes:/);
  assert.match(text(panel(html, 'decisoes')), /the copy reserves quota before writing, so a full Disk fails early\./);

  // O que vem das fontes é texto, e não marcação.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/i);

  // Nenhum recurso externo: nem script, nem folha de estilo, nem imagem, nem fonte.
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /\b(src|href)\s*=/i);
  assert.doesNotMatch(html, /url\(|@import/i);

  // Sem diff de schema e sem documento, as abas dizem que nada muda.
  const unchanged = build({ ...SOURCES, contract: CONTRACT.slice(0, CONTRACT.indexOf('# Schema')), docsDiff: '' });
  assert.equal(text(panel(unchanged, 'schema')), 'O schema não muda.');
  assert.equal(text(panel(unchanged, 'documentos')), 'Nenhum documento muda.');
});
