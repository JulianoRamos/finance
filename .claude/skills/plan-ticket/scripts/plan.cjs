// O parser do plano de um ticket: o arquivo de aceite (`parseAcceptanceFile`), as marcas de
// conferência (`CHECKS`) e a mensagem do commit de plano (`parseMessage`), nos formatos da skill de
// plano (formatos/aceite.md e formatos/mensagem.md). A página do plano (page.cjs) lê o plano por
// aqui, e o conferidor do aceite de um projeto pode importá-lo, para os dois lerem com as mesmas
// regras. Só usa a biblioteca padrão do Node.

// O nome do arquivo de aceite, na pasta de cada ticket (formatos/aceite.md, "Onde").
const ACCEPTANCE_NAME = 'aceite.md';

// As marcas de conferência, pela forma normalizada (em minúsculas): o nome como se escreve e se
// exige teste. Só as quatro primeiras exigem.
const CHECKS = new Map([
  ['teste http', { name: 'teste HTTP', test: true }],
  ['teste no playwright', { name: 'teste no Playwright', test: true }],
  ['teste de unidade', { name: 'teste de unidade', test: true }],
  ['teste de integração', { name: 'teste de integração', test: true }],
  ['revisão humana', { name: 'revisão humana', test: false }],
  ['documento', { name: 'documento', test: false }],
]);

const CRITERION_HEADING = /^#{1,6}\s*([A-Z][A-Z0-9]*-\d+-CA\d+)\b/;
// As linhas de um critério. O texto de cada uma vai até a próxima linha rotulada ou o próximo
// título, e pode ter mais de um parágrafo.
const FIELD = /^\s*[-*]?\s*\*\*(marca|cenário|teste previsto):\*\*\s*(.*)$/i;
const FIELD_KEYS = { marca: 'check', cenário: 'scenario', 'teste previsto': 'plannedTest' };

function normalize(text) {
  return text.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Um arquivo de aceite: a introdução (o texto antes do primeiro critério, sem os títulos) e os
 * critérios, lidos dos títulos `## <ticket>-CA<n>`: o ID, o arquivo, a marca (normalizada, em
 * minúsculas), o cenário e o teste previsto, nulo no critério que não o tem. Um critério só termina
 * no título do próximo critério. O texto de cada linha rotulada fica como está no arquivo, com as
 * quebras de linha. Não confere nada: uma marca desconhecida sai como está, para quem chama decidir.
 */
function parseAcceptanceFile(name, text) {
  const criteria = [];
  const intro = [];
  let current = null;
  let field = null;
  let lines = [];
  const close = () => {
    if (current && field) current[field] = lines.join('\n').trim() || null;
    field = null;
    lines = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const heading = line.trim().match(CRITERION_HEADING);
    if (heading) {
      close();
      current = { id: heading[1], file: name, check: null, scenario: null, plannedTest: null };
      criteria.push(current);
      continue;
    }
    // Outro título encerra a linha rotulada em curso, e não o critério: uma linha rotulada depois de
    // um subtítulo ainda é do critério.
    if (/^#{1,6}\s/.test(line.trim())) {
      close();
      continue;
    }
    if (!criteria.length) intro.push(line);
    const labeled = current && line.match(FIELD);
    if (labeled) {
      close();
      field = FIELD_KEYS[labeled[1].toLowerCase()];
      lines = [labeled[2]];
      // A marca é só a própria linha.
      if (field === 'check') close();
    } else if (field) {
      lines.push(line);
    }
  }
  close();
  for (const criterion of criteria) {
    if (criterion.check) criterion.check = normalize(criterion.check).toLowerCase().replace(/[.;]+$/, '');
  }
  return { intro: intro.join('\n').trim(), criteria };
}

// Os blocos da mensagem do commit de plano: o rótulo com que o parágrafo começa e, nos da aba
// "Arquivos e interfaces", a chave dele no resultado.
const DECISION = 'Decision:';
const FILE_BLOCKS = [
  { key: 'files', label: 'Files and interfaces the implementation will touch:' },
  { key: 'tests', label: 'Existing tests whose behavior changes:' },
  { key: 'data', label: 'Data changes:' },
  // Opcional: só o ticket que cita telas de um protótipo o traz (formatos/mensagem.md).
  { key: 'visual', label: 'Visual reference:', optional: true },
];
const LABELS = [DECISION, ...FILE_BLOCKS.map(({ label }) => label)];
// Uma linha de atribuição do fim da mensagem, como `Co-Authored-By: ...`: uma palavra sem espaço e
// os dois-pontos.
const TRAILER = /^[A-Za-z0-9-]+:\s/;

/** O rótulo com que a linha começa, ou `undefined`. */
function labelOf(line) {
  return LABELS.find((label) => line.startsWith(label));
}

/**
 * Onde começam as linhas de atribuição: o último parágrafo, quando todas as linhas dele são de
 * atribuição e nenhuma começa por um rótulo de bloco (um `Decision:` também tem a forma de uma).
 * Sem elas, o fim da mensagem.
 */
function trailersStart(lines) {
  let start = lines.length;
  while (start > 0 && lines[start - 1].trim() !== '') start -= 1;
  const last = lines.slice(start);
  const trailers = start > 1 && last.every((line) => TRAILER.test(line) && !labelOf(line));
  return trailers ? start : lines.length;
}

/**
 * Os blocos da mensagem do commit de plano: o texto inteiro, o assunto, cada `Decision:`, as listas
 * de arquivos, de testes e de mudança de dados e a referência visual (nulas quando faltam). Um bloco
 * começa na linha que abre com o rótulo dele e vai até a próxima linha que abre com um rótulo, ou até
 * as linhas de atribuição do fim, então pode ter mais de um parágrafo e uma linha em branco entre o
 * rótulo e a lista. O texto antes do primeiro rótulo não é de nenhum bloco. `null` quando não há
 * mensagem.
 */
function parseMessage(message) {
  if (message === null) return null;
  const lines = message.trim().split('\n');
  const parsed = { text: message, subject: lines[0], decisions: [], files: null, tests: null, data: null, visual: null };
  const blocks = [];
  for (const line of lines.slice(1, trailersStart(lines))) {
    const label = labelOf(line);
    if (label) blocks.push({ label, lines: [line.slice(label.length)] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  for (const { label, lines: own } of blocks) {
    const content = own.join('\n').trim();
    if (label === DECISION) parsed.decisions.push(content);
    else parsed[FILE_BLOCKS.find((entry) => entry.label === label).key] = content;
  }
  return parsed;
}

module.exports = { parseAcceptanceFile, CHECKS, ACCEPTANCE_NAME, parseMessage, DECISION, FILE_BLOCKS };
