// Renderiza, em Markdown, o contrato completo de cada rota nova ou alterada entre dois snapshots da
// OpenAPI, no formato de rota da skill de plano (formatos/contrato.md): uma seção por rota, com
// tabelas de parâmetros, de cabeçalhos e de erros. É a parte da visão do contrato que o `oasdiff
// changelog` não dá: numa rota nova, ele só diz que ela foi acrescentada.
//
// `routeChanges` monta o modelo das rotas que mudaram, e `render` o escreve em Markdown. A visão
// inteira (`view`) é a saída do comando do contrato deste projeto, no formato que a skill de plano
// lê (formatos/contrato.md, "Saída do comando do contrato"): as seções `# Contrato` e `# Schema`, que
// viram as abas de mesmo nome da página de revisão do plano.
//
// Roda dentro do contêiner `harness` (ver o `<app>_contract_view` da app dona do contrato, em scripts/verify/), sobre as
// fontes que o `api_contract_sources` junta na máquina e entrega pela entrada padrão:
//   node contract-view.cjs -
// A entrada tem o formato da entrada do construtor da página da skill de plano (o cabeçalho do
// page.cjs dela, que a lê pelo mesmo `readSources`), com as fontes `base` e `novo` (o texto dos dois
// snapshots), `changelog` (o `oasdiff changelog`, só quando os snapshots diferem) e `schemaDiff` (o
// diff do schema do Prisma).

const fs = require('node:fs');

const { readSources } = require('../.claude/skills/plan-ticket/scripts/page.cjs');

// As frases e os títulos de seção da visão.
const PHRASES = {
  sameSnapshot: 'O snapshot da OpenAPI é o mesmo nos dois pontos: o contrato não muda.',
  unchanged: 'O contrato não muda.',
  schemaUnchanged: 'O schema do Prisma não muda.',
  changelog: 'O que mudou no contrato (oasdiff changelog)',
  routes: 'Contrato completo das rotas novas ou alteradas',
  emptyChangelog: 'O `oasdiff changelog` não listou mudanças.',
};

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const LOCATIONS = { path: 'caminho', query: 'consulta', cookie: 'cookie' };
// O texto de documentação, que não muda o contrato. São os mesmos elementos que o `oasdiff diff`
// ignora no scripts/verify/api.sh.
const TEXT = new Set(['description', 'summary', 'example', 'examples']);
// Os objetos cujas chaves são nomes (de campo, de cabeçalho), e não palavras da OpenAPI: um campo
// chamado `description` é contrato.
const NAME_MAPS = new Set(['properties', 'headers', 'encoding']);

/** O nó para o qual um `$ref` local (`#/components/...`) aponta. */
function target(doc, ref) {
  return ref
    .slice(2)
    .split('/')
    .map((key) => key.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((node, key) => node?.[key], doc);
}

/** O schema com o `$ref` local resolvido e o `allOf` juntado num objeto só. */
function resolve(doc, schema, seen = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return { type: 'object' };
    return resolve(doc, target(doc, schema.$ref), new Set([...seen, schema.$ref]));
  }
  if (!schema.allOf) return schema;
  const { allOf, ...own } = schema;
  return [...allOf.map((part) => resolve(doc, part, seen)), own].reduce((merged, part) => ({
    ...merged,
    ...part,
    properties: { ...merged.properties, ...part.properties },
    required: [...(merged.required ?? []), ...(part.required ?? [])],
  }));
}

/**
 * As operações de um snapshot, por `MÉTODO caminho`, com os parâmetros do caminho e a segurança
 * global. Um parâmetro da operação com o mesmo nome e o mesmo `in` substitui o do caminho, como
 * manda a OpenAPI.
 */
function operations(doc) {
  const result = new Map();
  for (const [route, item] of Object.entries(doc?.paths ?? {})) {
    for (const method of METHODS.filter((name) => item[name])) {
      const op = item[method];
      const parameters = new Map();
      for (const param of [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p) => resolve(doc, p))) {
        parameters.set(`${param.in} ${param.name}`, param);
      }
      result.set(`${method.toUpperCase()} ${route}`, {
        ...op,
        parameters: [...parameters.values()],
        security: op.security ?? doc.security ?? [],
      });
    }
  }
  return result;
}

/**
 * Uma operação pronta para a comparação: os `$ref` resolvidos, o texto de documentação tirado e as
 * chaves em ordem. Duas operações com o mesmo contrato dão o mesmo resultado, mesmo que o renderizador
 * não mostre a diferença entre elas.
 */
function normalized(doc, node, names = false, seen = new Set()) {
  if (Array.isArray(node)) return node.map((item) => normalized(doc, item, false, seen));
  if (!node || typeof node !== 'object') return node;
  if (!names && typeof node.$ref === 'string') {
    if (seen.has(node.$ref)) return { $ref: node.$ref };
    return normalized(doc, target(doc, node.$ref), false, new Set([...seen, node.$ref]));
  }
  const out = {};
  for (const key of Object.keys(node).sort()) {
    if (!names && TEXT.has(key)) continue;
    out[key] = normalized(doc, node[key], !names && NAME_MAPS.has(key), seen);
  }
  return out;
}

/** As opções de um `oneOf` ou de um `anyOf`, quando o schema é uma união. */
function variants(schema) {
  return schema.oneOf ?? schema.anyOf;
}

/** O nome de uma opção da união: o do schema referenciado, ou o tipo dela. */
function variantName(doc, schema) {
  return schema.$ref ? schema.$ref.split('/').pop() : typeOf(doc, schema);
}

/** O tipo de um schema, em texto: `string (date-time)`, `array de objeto`, `string ou integer`. */
function typeOf(doc, schema) {
  const resolved = resolve(doc, schema);
  const union = variants(resolved);
  if (union) return union.map((option) => variantName(doc, option)).join(' ou ');
  const type = Array.isArray(resolved.type) ? resolved.type.join(' ou ') : resolved.type;
  if (resolved.enum) return `${type ?? 'valor'} (${resolved.enum.map((value) => JSON.stringify(value)).join(' | ')})`;
  if (resolved.const !== undefined) return `${type ?? 'valor'} (${JSON.stringify(resolved.const)})`;
  if (type === 'array') return `array de ${typeOf(doc, resolved.items)}`;
  if (resolved.properties) return 'objeto';
  if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
    return `objeto de chaves livres, com valor ${typeOf(doc, resolved.additionalProperties)}`;
  }
  return resolved.format ? `${type} (${resolved.format})` : (type ?? 'qualquer');
}

/** Um limite inferior ou superior, com o exclusivo da OpenAPI 3.0 (booleano) e o da 3.1 (número). */
function bound(schema, inclusive, exclusive, inclusiveText, exclusiveText) {
  if (typeof schema[exclusive] === 'number') return `${exclusiveText} ${schema[exclusive]}`;
  if (schema[inclusive] === undefined) return null;
  return `${schema[exclusive] === true ? exclusiveText : inclusiveText} ${schema[inclusive]}`;
}

/** As marcas e os limites de um schema, em texto. */
function limits(schema) {
  const parts = [];
  if (schema.deprecated) parts.push('obsoleto');
  if (schema.readOnly) parts.push('só na resposta');
  if (schema.writeOnly) parts.push('só na entrada');
  if (schema.nullable) parts.push('aceita null');
  if (schema.minLength !== undefined && schema.maxLength !== undefined) {
    parts.push(`de ${schema.minLength} a ${schema.maxLength} caracteres`);
  } else if (schema.minLength !== undefined) {
    parts.push(`ao menos ${schema.minLength} caractere(s)`);
  } else if (schema.maxLength !== undefined) {
    parts.push(`até ${schema.maxLength} caracteres`);
  }
  parts.push(
    ...[
      bound(schema, 'minimum', 'exclusiveMinimum', 'mínimo', 'maior que'),
      bound(schema, 'maximum', 'exclusiveMaximum', 'máximo', 'menor que'),
    ].filter(Boolean),
  );
  if (schema.multipleOf !== undefined) parts.push(`múltiplo de ${schema.multipleOf}`);
  if (schema.minItems !== undefined) parts.push(`ao menos ${schema.minItems} item(ns)`);
  if (schema.maxItems !== undefined) parts.push(`até ${schema.maxItems} item(ns)`);
  if (schema.uniqueItems) parts.push('sem itens repetidos');
  if (schema.pattern !== undefined) parts.push(`no padrão /${schema.pattern}/`);
  if (schema.default !== undefined) parts.push(`padrão ${JSON.stringify(schema.default)}`);
  return parts;
}

/** Um campo, um parâmetro ou um cabeçalho do modelo: nome, tipo, se é obrigatório e os limites. */
function item(doc, name, schema, required, extra = {}) {
  const resolved = resolve(doc, schema);
  return {
    name,
    type: typeOf(doc, schema),
    required: Boolean(required),
    limits: limits({ ...resolved, deprecated: resolved.deprecated || extra.deprecated }),
  };
}

/**
 * Os campos de um objeto, em ordem, com a profundidade de cada um: os objetos aninhados e os itens
 * das listas expandidos. Numa união, os campos de cada opção vêm abaixo do nome dela (`option`).
 */
function fields(doc, schema, depth = 0, seen = new Set()) {
  let resolved = resolve(doc, schema);
  if (resolved.type === 'array') resolved = resolve(doc, resolved.items);
  const union = variants(resolved);
  if (union) {
    return union.flatMap((option) => {
      const own = fields(doc, option, depth + 1, seen);
      return own.length ? [{ depth, option: variantName(doc, option) }, ...own] : [];
    });
  }
  const required = new Set(resolved.required ?? []);
  return Object.entries(resolved.properties ?? {}).flatMap(([name, child]) => {
    const own = { depth, ...item(doc, name, child, required.has(name)) };
    const key = JSON.stringify(child);
    if (seen.has(key)) return [own];
    return [own, ...fields(doc, child, depth + 1, new Set([...seen, key]))];
  });
}

/**
 * Os tipos de conteúdo de um corpo, juntando os que têm o mesmo schema: `[{ types, schema }]`.
 * Vazio quando o corpo não tem conteúdo.
 */
function contents(doc, body) {
  const groups = new Map();
  for (const [type, media] of Object.entries(body?.content ?? {})) {
    const key = JSON.stringify(normalized(doc, media.schema ?? {}));
    if (!groups.has(key)) groups.set(key, { types: [], schema: media.schema });
    groups.get(key).types.push(type);
  }
  return [...groups.values()];
}

/** Os `code` de um erro no formato do `ApiProblem`, de todos os tipos de conteúdo dele, sem repetir. */
function codes(doc, response) {
  const values = contents(doc, response).flatMap(
    ({ schema }) => resolve(doc, schema).properties?.code?.enum ?? [],
  );
  return [...new Set(values)];
}

/** A ordem dos status: numérica, com as faixas (`4XX`) depois dos status delas e o `default` no fim. */
function rank(status) {
  if (/^\d{3}$/.test(status)) return Number(status);
  if (/^[1-5]XX$/i.test(status)) return Number(status[0]) * 100 + 99.5;
  return Infinity;
}

/** Erro é o status 4xx ou 5xx, e o `default`, que cobre o que a rota não declara. */
function isError(status) {
  return /^[45]/.test(status) || status === 'default';
}

function headers(doc, response) {
  return Object.entries(response.headers ?? {}).map(([name, header]) => {
    const resolved = resolve(doc, header);
    return item(doc, name, resolved.schema, resolved.required, resolved);
  });
}

/**
 * O contrato completo de uma operação, no formato da seção 3 do LLD. Só traz o que o formato
 * descreve, então descrições, resumos, exemplos, o operationId e as tags não mudam o modelo.
 */
function contract(doc, op) {
  const schemes = [...new Set(op.security.flatMap((requirement) => Object.keys(requirement)))];
  const requestBody = resolve(doc, op.requestBody);
  const responses = Object.entries(op.responses ?? {})
    .map(([status, response]) => [status, resolve(doc, response)])
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return {
    schemes,
    deprecated: Boolean(op.deprecated),
    parameters: op.parameters
      .filter((param) => param.in !== 'header')
      .map((param) => ({ ...item(doc, param.name, param.schema, param.required, param), location: LOCATIONS[param.in] ?? param.in })),
    inputHeaders: op.parameters
      .filter((param) => param.in === 'header')
      .map((param) => item(doc, param.name, param.schema, param.required, param)),
    bodies: contents(doc, requestBody).map(({ types, schema }) => ({
      types,
      required: Boolean(requestBody.required),
      fields: fields(doc, schema),
    })),
    // Como na OpenAPI: os cabeçalhos são da resposta, e cada tipo de conteúdo tem o seu corpo.
    success: responses
      .filter(([status]) => !isError(status))
      .map(([status, response]) => ({
        status,
        headers: headers(doc, response),
        bodies: contents(doc, response).map(({ types, schema }) => ({ types, fields: fields(doc, schema) })),
      })),
    errors: responses
      .filter(([status]) => isError(status))
      .map(([status, response]) => ({ status, codes: codes(doc, response), headers: headers(doc, response) })),
  };
}

/**
 * O modelo das rotas novas, alteradas e removidas entre dois snapshots: `[{ change, method, path,
 * ...contrato }]`, na ordem do snapshot novo, com as removidas no fim e sem o contrato. Uma rota conta
 * como alterada quando a operação, sem o texto de documentação, muda, e não só quando o texto
 * renderizado muda: assim, uma mudança que o renderizador não mostra ainda aparece, e o changelog do
 * `oasdiff` a detalha.
 */
function routeChanges(base, head) {
  const before = operations(base);
  const after = operations(head);
  const same = (key) =>
    JSON.stringify(normalized(base, before.get(key))) === JSON.stringify(normalized(head, after.get(key)));
  const route = (key) => {
    const [method, ...rest] = key.split(' ');
    return { method, path: rest.join(' ') };
  };
  const changes = [];
  for (const [key, op] of after) {
    if (!before.has(key)) changes.push({ change: 'nova', ...route(key), ...contract(head, op) });
    else if (!same(key)) changes.push({ change: 'alterada', ...route(key), ...contract(head, op) });
  }
  for (const key of before.keys()) {
    if (!after.has(key)) changes.push({ change: 'removida', ...route(key) });
  }
  return changes;
}

/** `nome`: tipo, obrigatório, limites. */
function described(entry) {
  return [`\`${entry.name}\`: ${entry.type}`, entry.required ? 'obrigatório' : 'opcional', ...entry.limits].join(', ');
}

/** Um campo de um corpo, na lista aninhada: a descrição dele, ou o nome da opção da união. */
function fieldText(entry) {
  return entry.option ? `Opção ${entry.option}:` : described(entry);
}

// As tabelas da seção de uma rota: `{ head, rows }`, com o cabeçalho e as células em Markdown de uma
// linha (o nome e o `code` entre crases).

function parameterTable(route) {
  return {
    head: ['Nome', 'Onde', 'Tipo', 'Obrigatório', 'Limites'],
    rows: route.parameters.map((param) => [`\`${param.name}\``, param.location, param.type, param.required ? 'sim' : 'não', param.limits.join(', ')]),
  };
}

/** Os cabeçalhos de entrada (`first` é `Nome`) ou os de uma resposta (`Cabeçalho de resposta`). */
function headerTable(first, entries) {
  return {
    head: [first, 'Tipo', 'Obrigatório', 'Limites'],
    rows: entries.map((entry) => [`\`${entry.name}\``, entry.type, entry.required ? 'sim' : 'não', entry.limits.join(', ')]),
  };
}

/** Os erros: o status, os `code` e, se algum erro tem cabeçalhos, uma coluna com eles. */
function errorTable(route) {
  const withHeaders = route.errors.some((error) => error.headers.length);
  return {
    head: ['Status', '`code`', ...(withHeaders ? ['Cabeçalhos'] : [])],
    rows: route.errors.map((error) => [
      error.status,
      error.codes.length ? error.codes.map((code) => `\`${code}\``).join(', ') : 'sem `code` declarado',
      ...(withHeaders ? [error.headers.map(described).join('; ')] : []),
    ]),
  };
}

/** Uma célula de tabela do Markdown, com a barra vertical escapada. A vazia fica vazia. */
function cell(value) {
  return String(value).replaceAll('|', '\\|');
}

function table({ head, rows }) {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

function list(entries) {
  return entries.map((entry) => `${'  '.repeat(entry.depth)}- ${fieldText(entry)}`).join('\n');
}

/** O título de uma rota: se é nova, alterada ou removida, o método, o caminho e a autenticação. */
function routeTitle(route) {
  const parts = [`Rota ${route.change}`, `${route.method} ${route.path}`];
  if (route.change !== 'removida') {
    parts.push(route.schemes.length ? `protegida (${route.schemes.join(', ')})` : 'pública');
  }
  return parts.join(' · ');
}

/** A seção de uma rota, em blocos do Markdown separados por uma linha em branco. */
function section(route) {
  const blocks = [`### ${routeTitle(route)}`];
  if (route.change === 'removida') return blocks;
  if (route.deprecated) blocks.push('Obsoleta (deprecated).');
  if (route.parameters.length) blocks.push('#### Parâmetros', table(parameterTable(route)));
  if (route.inputHeaders.length) blocks.push('#### Cabeçalhos de entrada', table(headerTable('Nome', route.inputHeaders)));
  for (const body of route.bodies) {
    blocks.push(`#### Corpo (${body.types.join(', ')}), ${body.required ? 'obrigatório' : 'opcional'}`);
    if (body.fields.length) blocks.push(list(body.fields));
  }
  for (const response of route.success) {
    if (!response.bodies.length) blocks.push(`#### Sucesso ${response.status} (sem corpo)`);
    for (const body of response.bodies) {
      blocks.push(`#### Sucesso ${response.status} (${body.types.join(', ')})`);
      if (body.fields.length) blocks.push(list(body.fields));
    }
    if (response.headers.length) blocks.push(table(headerTable('Cabeçalho de resposta', response.headers)));
  }
  if (route.errors.length) blocks.push('#### Erros', table(errorTable(route)));
  return blocks;
}

/**
 * O contrato das rotas que mudaram entre dois snapshots, em Markdown: uma seção por rota, ou a nota
 * de que o contrato não muda.
 */
function render(base, head) {
  const changes = routeChanges(base, head);
  if (!changes.length) return `${note(PHRASES.unchanged)}\n`;
  return `${changes.map((route) => section(route).join('\n\n')).join('\n\n')}\n`;
}

/** Uma nota de vazio, no formato da skill de plano: um parágrafo todo em itálico. */
function note(text) {
  return `*${text}*`;
}

/**
 * A visão, a partir das fontes, no formato de saída do comando do contrato da skill de plano: a seção
 * `# Contrato`, com o changelog e o contrato das rotas, ou a nota de que o snapshot é o mesmo, e a
 * seção `# Schema`, com o diff do schema, ou a nota de que ele não muda.
 */
function view({ base, novo, changelog = null, schemaDiff = '' }) {
  const blocks = ['# Contrato'];
  if (changelog === null) {
    blocks.push(note(PHRASES.sameSnapshot));
  } else {
    blocks.push(
      `## ${PHRASES.changelog}`,
      changelog.trim() ? `\`\`\`text\n${changelog.trimEnd()}\n\`\`\`` : note(PHRASES.emptyChangelog),
      `## ${PHRASES.routes}`,
      render(JSON.parse(base), JSON.parse(novo)).trimEnd(),
    );
  }
  // O diff vai inteiro, só sem a quebra de linha do fim: uma linha de contexto em branco no fim dele
  // continua lá.
  blocks.push(
    '# Schema',
    schemaDiff.trim() ? `\`\`\`diff\n${schemaDiff.replace(/\n$/, '')}\n\`\`\`` : note(PHRASES.schemaUnchanged),
  );
  return `${blocks.join('\n\n')}\n`;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] !== '-') {
    console.error('Uso: node contract-view.cjs -  (as fontes, em pares nome e valor terminados por NUL, na entrada padrão)');
    process.exit(2);
  }
  process.stdout.write(view(readSources(fs.readFileSync(0, 'utf8'))));
}

module.exports = { routeChanges, render };
