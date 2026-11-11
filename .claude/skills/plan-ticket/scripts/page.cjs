// Monta a página de revisão do plano de um ticket: um HTML estático, com uma aba por parte do plano
// (Aceite, Contrato, Schema, Documentos, Arquivos e interfaces e Decisões), para o humano aprovar o
// plano antes do commit de plano. O que cada aba mostra está no SKILL.md da skill de plano.
//
// O construtor (`build`) não lê nada sozinho: recebe as fontes e devolve o HTML. Todo texto das fontes
// é escapado, e a página não carrega nenhum recurso externo nem tem script: as abas são de CSS. As
// abas Contrato e Schema vêm do Markdown que o comando do contrato do projeto imprime, no formato
// de formatos/contrato.md. Só usa a biblioteca padrão do Node.
//
// Quem o chama é o plan-page.sh, pelo comando do Node do projeto, com as fontes que ele junta pelo
// `git` na entrada padrão:
//   node page.cjs -
// A entrada é uma sequência de pares nome e valor, cada um terminado por um NUL, como o
// `printf '%s\0' <nome> <valor>` os escreve. Os nomes são os campos do `build`: `ticket`, `origin`,
// `acceptancePath`, `acceptance`, `contract` (só quando o projeto declara um comando do contrato),
// `message`, `docsDiff` e `pending`, este num texto só, uma mudança por linha, como o
// `git status --porcelain` as escreve. A fonte que não está na entrada conta como ausente.

const fs = require('node:fs');

const { parseAcceptanceFile, CHECKS, parseMessage, DECISION, FILE_BLOCKS } = require('./plan.cjs');

// As abas, nesta ordem: o id, o rótulo e o que monta o painel, a partir das fontes do `build`.
const TABS = [
  { id: 'aceite', label: 'Aceite', panel: (s) => acceptanceTab(s.ticket, s.acceptancePath, s.acceptance) },
  { id: 'contrato', label: 'Contrato', panel: (s) => contractTab(s.contract) },
  { id: 'schema', label: 'Schema', panel: (s) => schemaTab(s.contract) },
  { id: 'documentos', label: 'Documentos', panel: (s) => documentsTab(s.docsDiff) },
  { id: 'arquivos', label: 'Arquivos e interfaces', panel: (s) => filesTab(s.parsed) },
  { id: 'decisoes', label: 'Decisões', panel: (s) => decisionsTab(s.parsed) },
];

// O título de cada bloco da mensagem na aba "Arquivos e interfaces".
const HEADINGS = {
  files: 'Arquivos e interfaces que a implementação vai tocar',
  tests: 'Testes existentes cujo comportamento muda',
  data: 'Mudança de dados',
  visual: 'Referência visual',
};

function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * O texto de uma linha do Markdown, escapado, com o código entre crases e o negrito. O código sai
 * do texto antes (cada trecho vira uma marca com o índice dele, entre caracteres nulos, que o texto
 * não traz) para o negrito ser procurado no texto todo: assim, um negrito com código dentro fecha,
 * e um `**` dentro do código não abre negrito. Um `**` sem par fica como texto.
 */
function inline(value) {
  const codes = [];
  const text = String(value)
    .replaceAll('\0', '')
    .replace(/`([^`]*)`/g, (_, code) => `\0${codes.push(code) - 1}\0`);
  return escape(text)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/\0(\d+)\0/g, (_, index) => `<code>${escape(codes[Number(index)])}</code>`);
}

/** Uma lista aninhada pela profundidade de cada item: `[{ depth, html }]`. */
function nestedList(items) {
  let html = '';
  let depth = -1;
  for (const item of items) {
    if (item.depth > depth) {
      html += '<ul><li>'.repeat(item.depth - depth);
    } else {
      html += '</li></ul>'.repeat(depth - item.depth) + '</li><li>';
    }
    depth = item.depth;
    html += item.html;
  }
  return html + '</li></ul>'.repeat(depth + 1);
}

/** Uma tabela (`{ head, rows }`), com as células de Markdown de uma linha em HTML. */
function table({ head, rows }) {
  return (
    `<div class="rolagem"><table><thead><tr>${head.map((value) => `<th>${inline(value)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((row) => `<tr>${row.map((value) => `<td>${inline(value)}</td>`).join('')}</tr>`).join('') +
    '</tbody></table></div>'
  );
}

/**
 * Um diff unificado, com as linhas acrescentadas, removidas e os cabeçalhos marcados. Os cabeçalhos
 * de um arquivo só vêm antes do primeiro trecho (`@@`) dele: dentro do trecho, a linha que parece
 * `--- ` ou `+++ ` é uma linha removida ou acrescentada.
 */
function diff(text) {
  let hunk = false;
  const kind = (line) => {
    if (line.startsWith('diff --git ')) {
      hunk = false;
      return 'meta';
    }
    if (line.startsWith('@@')) {
      hunk = true;
      return 'trecho';
    }
    if (!hunk) return 'meta';
    if (line.startsWith('+')) return 'mais';
    if (line.startsWith('-')) return 'menos';
    return '';
  };
  return `<pre class="diff">${String(text)
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      const css = kind(line);
      return css ? `<span class="${css}">${escape(line)}</span>` : escape(line);
    })
    .join('\n')}</pre>`;
}

function empty(message) {
  return `<p class="vazio">${inline(message)}</p>`;
}

function acceptanceTab(ticket, acceptancePath, acceptance) {
  if (acceptance === null) return empty(`O plano não tem o arquivo de aceite \`${acceptancePath}\`.`);
  const { intro, criteria } = parseAcceptanceFile(`${ticket}.md`, acceptance);
  const head = intro ? `${markdown(intro)}\n` : '';
  if (!criteria.length) return `${head}${empty('O arquivo de aceite não tem nenhum critério.')}`;
  const rows = criteria.map((criterion) => {
    const check = CHECKS.get(criterion.check)?.name ?? criterion.check ?? 'marca ausente';
    const scenario = criterion.scenario ? markdown(criterion.scenario) : empty('Sem cenário.');
    const planned = criterion.plannedTest
      ? `<details><summary>Teste previsto</summary>${markdown(criterion.plannedTest)}</details>`
      : '';
    return `<tr class="criterio"><td class="id">${escape(criterion.id)}</td><td>${escape(check)}</td><td>${scenario}${planned}</td></tr>`;
  });
  return `${head}<div class="rolagem"><table class="aceite"><thead><tr><th>ID</th><th>Marca</th><th>Cenário</th></tr></thead><tbody>
${rows.join('\n')}
</tbody></table></div>`;
}

// Um bloco de código abre numa cerca com ou sem a linguagem, e fecha só numa cerca sem nada.
const FENCE = /^\s*```\s*(\S*)\s*$/;
const CLOSING_FENCE = /^\s*```\s*$/;
// Um título: os `#` e um espaço. A sequência de `#` do fim só é de fechamento, e sai, quando tem um
// espaço antes (como no CommonMark): `## x-c#` mantém o `#`.
const HEADING = /^(#{1,6})(?=\s)(.*?)(?:\s+#+)?\s*$/;
const ROW = /^\s*\|/;
const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const LIST_ITEM = /^(\s*)[-*]\s+(.*)$/;
// Um parágrafo que é um só trecho em itálico, com um asterisco de cada lado e nenhum dentro, é uma
// nota de vazio, como "o contrato não muda" (formatos/contrato.md).
const NOTE = /^\*(?=[^*\s])([^*]*[^*\s])\*$/;

/** As células de uma linha de tabela do Markdown: as barras das pontas tiradas e a `\|` como texto. */
function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((value) => value.trim().replaceAll('\\|', '|'));
}

/**
 * Um Markdown em HTML, o de todas as abas que vêm de texto (o aceite, o contrato e a mensagem), com o
 * que o contrato de um projeto usa (formatos/contrato.md): títulos, parágrafos, notas de vazio,
 * tabelas, listas aninhadas (dois espaços por nível) e blocos de código; o bloco `diff` sai com as
 * linhas marcadas, como na aba Documentos. Todo texto é escapado, e o que não é desses blocos sai
 * como parágrafo.
 */
function markdown(value) {
  const lines = String(value).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let index = 0;
  const startsBlock = (line) => FENCE.test(line) || HEADING.test(line) || ROW.test(line) || LIST_ITEM.test(line);
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(FENCE);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !CLOSING_FENCE.test(lines[index])) code.push(lines[index++]);
      index += 1;
      html.push(fence[1] === 'diff' ? diff(code.join('\n')) : `<pre>${escape(code.join('\n'))}</pre>`);
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }
    if (ROW.test(line) && SEPARATOR.test(lines[index + 1] ?? '')) {
      const head = cells(line);
      const rows = [];
      index += 2;
      while (index < lines.length && ROW.test(lines[index])) rows.push(cells(lines[index++]));
      html.push(table({ head, rows }));
      continue;
    }
    // A lista vai até uma linha em branco ou um bloco que não é item (um título, uma cerca, uma linha
    // de tabela); a linha que não é nada disso continua o último item.
    if (LIST_ITEM.test(line)) {
      const items = [];
      const ends = (next) => !next.trim() || FENCE.test(next) || HEADING.test(next) || ROW.test(next);
      while (index < lines.length && !ends(lines[index])) {
        const item = lines[index].match(LIST_ITEM);
        if (item) items.push({ depth: Math.floor(item[1].length / 2), text: item[2] });
        else items[items.length - 1].text += ` ${lines[index].trim()}`;
        index += 1;
      }
      html.push(nestedList(items.map((item) => ({ depth: item.depth, html: inline(item.text) }))));
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !(paragraph.length && startsBlock(lines[index]))) {
      paragraph.push(lines[index++]);
    }
    const joined = paragraph.join('\n').trim().replace(/\s*\n\s*/g, ' ');
    const note = joined.match(NOTE);
    html.push(note ? empty(note[1]) : `<p>${inline(joined)}</p>`);
  }
  return html.join('\n');
}

const NO_CONTRACT = 'O projeto não declara contrato.';

/**
 * As seções `# Contrato` e `# Schema` do Markdown do contrato, cada uma sem o título: `{ contrato,
 * schema }`, com `null` na que não aparece. O que vem antes da primeira seção fica de fora, e um `#`
 * dentro de um bloco de código não abre seção. O bloco abre e fecha como no `markdown`: dentro dele,
 * só uma cerca sem nada o fecha.
 */
function sections(contract) {
  const found = { contrato: null, schema: null };
  let current = null;
  let fenced = false;
  for (const line of String(contract).replace(/\r\n/g, '\n').split('\n')) {
    if (fenced) fenced = !CLOSING_FENCE.test(line);
    else fenced = FENCE.test(line);
    const title = !fenced && line.match(/^#\s+(Contrato|Schema)\s*$/i);
    if (title) {
      current = title[1].toLowerCase();
      found[current] ??= [];
      continue;
    }
    if (current) found[current].push(line);
  }
  return { contrato: found.contrato?.join('\n') ?? null, schema: found.schema?.join('\n') ?? null };
}

/** Uma aba do contrato: o projeto sem contrato, a seção que não veio (nada muda) ou o Markdown dela. */
function contractSection(contract, key, unchanged) {
  if (contract === null) return empty(NO_CONTRACT);
  const section = sections(contract)[key];
  return section?.trim() ? markdown(section) : empty(unchanged);
}

function contractTab(contract) {
  return contractSection(contract, 'contrato', 'O contrato não muda.');
}

function schemaTab(contract) {
  return contractSection(contract, 'schema', 'O schema não muda.');
}

const ESCAPES = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/**
 * Um caminho como o `git` o escreve no diff: entre aspas, com os escapes do C (e os bytes em octal),
 * quando tem um caractere especial, ou como está.
 */
function unquote(value) {
  if (!/^".*"$/.test(value)) return value;
  const bytes = [];
  const body = value.slice(1, -1);
  for (let index = 0; index < body.length; index += 1) {
    const octal = body.slice(index).match(/^\\([0-7]{3})/);
    if (octal) {
      bytes.push(parseInt(octal[1], 8));
      index += 3;
    } else if (body[index] === '\\' && body[index + 1] in ESCAPES) {
      bytes.push(ESCAPES[body[index + 1]]);
      index += 1;
    } else {
      bytes.push(...Buffer.from(body[index]));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * O arquivo de um trecho do diff (as linhas de um `diff --git` até o seguinte): o caminho novo, do
 * `rename to` ou do `+++ b/`, ou o antigo, do `--- a/`, quando o arquivo foi apagado. Sem essas linhas
 * (um arquivo binário, um modo que muda), o caminho sai do próprio `diff --git a/<x> b/<x>`, cujas
 * duas metades são iguais. O diff vem com os prefixos `a/` e `b/` fixos (ver o `plain_diff` do
 * plan-page.sh), e o `git` só põe o caminho entre aspas quando ele tem um caractere especial.
 */
function fileOf([header, ...lines]) {
  const hunk = lines.findIndex((line) => line.startsWith('@@'));
  const meta = hunk === -1 ? lines : lines.slice(0, hunk);
  const after = (prefix) => {
    const line = meta.find((entry) => entry.startsWith(prefix));
    return line === undefined ? null : unquote(line.slice(prefix.length).replace(/\t$/, ''));
  };
  const renamed = after('rename to ');
  if (renamed !== null) return renamed;
  const added = after('+++ ');
  if (added !== null && added !== '/dev/null') return added.replace(/^b\//, '');
  const removed = after('--- ');
  if (removed !== null && removed !== '/dev/null') return removed.replace(/^a\//, '');
  const both = header.slice('diff --git '.length);
  const size = (both.length - 5) / 2;
  if (
    Number.isInteger(size) &&
    both.startsWith('a/') &&
    both.slice(2 + size, size + 5) === ' b/' &&
    both.slice(2, 2 + size) === both.slice(size + 5)
  ) {
    return both.slice(size + 5);
  }
  const quoted = both.lastIndexOf(' "b/');
  return quoted === -1 ? both : unquote(both.slice(quoted + 1)).replace(/^b\//, '');
}

/** O diff dos documentos, separado por arquivo: `[{ file, text }]`. */
function byFile(text) {
  const files = [];
  for (const line of String(text).replace(/\n$/, '').split('\n')) {
    if (line.startsWith('diff --git ')) files.push([]);
    if (files.length) files[files.length - 1].push(line);
  }
  return files.map((lines) => ({ file: fileOf(lines), text: lines.join('\n') }));
}

function documentsTab(docsDiff) {
  const files = byFile(docsDiff);
  if (!files.length) return empty('Nenhum documento muda.');
  return files.map(({ file, text }) => `<h2><code>${escape(file)}</code></h2>\n${diff(text)}`).join('\n');
}

function absent(label) {
  return empty(`Ausente na mensagem proposta: falta o bloco \`${label}\`.`);
}

function filesTab(parsed) {
  if (!parsed) return empty('Não há mensagem proposta.');
  return FILE_BLOCKS.map(({ key, label, optional }) => {
    const body = parsed[key] ? markdown(parsed[key]) : optional ? empty('Nenhuma: o plano não cita telas de protótipo.') : absent(label);
    return `<h2>${HEADINGS[key]}</h2>\n${body}`;
  }).join('\n');
}

function decisionsTab(parsed) {
  if (!parsed) return empty('Não há mensagem proposta.');
  const decisions = parsed.decisions.length
    ? `<ol class="decisoes">${parsed.decisions.map((decision) => `<li>${markdown(decision)}</li>`).join('')}</ol>`
    : absent(DECISION);
  return `${decisions}
<details><summary>Mensagem proposta, na íntegra</summary><pre>${escape(parsed.text.replace(/\n$/, ''))}</pre></details>`;
}

const STYLE = `
:root { color-scheme: light dark; --fundo: #ffffff; --superficie: #f5f6f8; --texto: #1f2328; --suave: #59636e;
  --borda: #d1d9e0; --destaque: #0b5cad; --mais: #dafbe1; --mais-texto: #116329; --menos: #ffebe9;
  --menos-texto: #a40e26; --trecho: #6639ba; --aviso: #fff8c5; --aviso-borda: #d4a72c; }
@media (prefers-color-scheme: dark) {
  :root { --fundo: #0d1117; --superficie: #161b22; --texto: #e6edf3; --suave: #9198a1; --borda: #30363d;
    --destaque: #4493f8; --mais: #12261e; --mais-texto: #3fb950; --menos: #25171c; --menos-texto: #f85149;
    --trecho: #ab7df8; --aviso: #272115; --aviso-borda: #9e6a03; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 48px; background: var(--fundo); color: var(--texto);
  font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
header, .abas { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0 0 4px; }
h2 { font-size: 1.15rem; margin: 24px 0 8px; }
h3, h4, h5, h6 { font-size: 1rem; margin: 20px 0 8px; }
.assunto { margin: 0; font-weight: 600; }
.origem { margin: 4px 0 0; color: var(--suave); font-size: 0.9rem; }
.aviso { margin: 16px 0 0; padding: 12px 16px; background: var(--aviso); border: 1px solid var(--aviso-borda);
  border-radius: 6px; }
.aviso p { margin: 0 0 6px; }
.aviso ul { margin: 0; }
.abas > input { position: absolute; opacity: 0; pointer-events: none; }
.abas nav { display: flex; flex-wrap: wrap; gap: 4px; margin: 20px 0 0; border-bottom: 1px solid var(--borda); }
.abas nav label { padding: 8px 14px; border: 1px solid transparent; border-bottom: none; border-radius: 6px 6px 0 0;
  cursor: pointer; color: var(--suave); margin-bottom: -1px; }
.painel { display: none; padding: 8px 0; }
${TABS.map(({ id }) => `#tab-${id}:checked ~ nav label[for="tab-${id}"]`).join(',\n')} {
  color: var(--texto); background: var(--fundo); border-color: var(--borda); font-weight: 600; }
${TABS.map(({ id }) => `#tab-${id}:checked ~ #aba-${id}`).join(',\n')} { display: block; }
${TABS.map(({ id }) => `#tab-${id}:focus-visible ~ nav label[for="tab-${id}"]`).join(',\n')} {
  outline: 2px solid var(--destaque); outline-offset: 2px; }
/* A tabela larga rola dentro da própria caixa, e não a página. */
.rolagem { overflow-x: auto; margin: 8px 0 16px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--borda); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--superficie); }
td.id { white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; }
td p { margin: 0 0 6px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; background: var(--superficie);
  padding: 1px 4px; border-radius: 4px; }
pre { background: var(--superficie); border: 1px solid var(--borda); border-radius: 6px; padding: 12px; overflow-x: auto;
  font: 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
/* Os documentos têm um parágrafo por linha: no diff, a linha quebra, em vez de rolar. */
pre.diff { white-space: pre-wrap; overflow-wrap: anywhere; }
pre code { background: none; padding: 0; }
.diff .mais { display: inline-block; width: 100%; background: var(--mais); color: var(--mais-texto); }
.diff .menos { display: inline-block; width: 100%; background: var(--menos); color: var(--menos-texto); }
.diff .trecho { color: var(--trecho); }
.diff .meta { color: var(--suave); font-weight: 600; }
details { margin: 6px 0; }
summary { cursor: pointer; color: var(--destaque); }
.vazio { color: var(--suave); font-style: italic; }
ol.decisoes > li { margin-bottom: 12px; }
`;

/**
 * O aviso do topo da página, quando a pasta de trabalho tem mudanças que o índice não tem nos
 * caminhos do plano: a página e o commit de plano leem só o índice, então elas ficam de fora dos dois.
 */
function pendingNotice(pending) {
  if (!pending.length) return '';
  return `<div class="aviso" role="alert"><p><strong>Há mudanças fora do índice nos caminhos do plano.</strong> A página e o commit de plano leem só o que está preparado no índice, então estas mudanças não aparecem nas abas nem entram no commit. Prepare-as com <code>git add</code>, ou desfaça-as, e monte a página de novo:</p>
<ul>${pending.map((line) => `<li><code>${escape(line)}</code></li>`).join('')}</ul></div>`;
}

/**
 * A página do plano. `ticket` e `origin` (de onde ela foi montada) são texto; `acceptancePath`, o
 * caminho do arquivo de aceite no repositório, e `acceptance`, o texto dele; `contract`, o Markdown que o comando do contrato do projeto imprime, `null`
 * quando o projeto não declara contrato; `docsDiff`, um diff unificado; `message`, a mensagem
 * proposta do commit de plano; e `pending`, as mudanças da pasta de trabalho que o índice não tem nos
 * caminhos do plano, uma por item. A fonte ausente pode vir `null` ou faltar.
 */
function build({ ticket, origin, acceptancePath, acceptance, contract, docsDiff, message, pending }) {
  const sources = {
    ticket,
    acceptancePath: acceptancePath ?? `${ticket}.md`,
    acceptance: acceptance ?? null,
    contract: contract ?? null,
    docsDiff: docsDiff ?? '',
    parsed: parseMessage(message ?? null),
  };
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plano do ${escape(ticket)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>Plano do ${escape(ticket)}</h1>
${sources.parsed?.subject ? `<p class="assunto">${inline(sources.parsed.subject)}</p>` : ''}
<p class="origem">${escape(origin)}</p>
${pendingNotice(pending ?? [])}
</header>
<main class="abas">
${TABS.map(({ id }, index) => `<input type="radio" name="aba" id="tab-${id}"${index === 0 ? ' checked' : ''}>`).join('\n')}
<nav>
${TABS.map(({ id, label }) => `<label for="tab-${id}">${label}</label>`).join('\n')}
</nav>
${TABS.map(({ id, label, panel }) => `<section class="painel" id="aba-${id}" aria-label="${label}">\n${panel(sources)}\n</section>`).join('\n')}
</main>
</body>
</html>
`;
}

/** As fontes da entrada padrão: os pares nome e valor do cabeçalho, num objeto. */
function readSources(input) {
  const parts = input.split('\0');
  if (parts.pop() !== '' || parts.length % 2 !== 0) {
    throw new Error('a entrada não é uma sequência de pares nome e valor, cada um terminado por um NUL.');
  }
  const sources = {};
  for (let index = 0; index < parts.length; index += 2) sources[parts[index]] = parts[index + 1];
  return sources;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '-') {
    console.error('Uso: node page.cjs -  (as fontes, em pares nome e valor terminados por NUL, na entrada padrão)');
    process.exit(2);
  }
  const sources = readSources(fs.readFileSync(0, 'utf8'));
  process.stdout.write(build({ ...sources, pending: (sources.pending ?? '').split('\n').filter(Boolean) }));
}

module.exports = { build, readSources };
