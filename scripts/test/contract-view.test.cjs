// Testes do renderizador da visão do contrato, pela interface que o scripts/verify/api.sh usa: dois
// snapshots da OpenAPI na entrada e o Markdown na saída, que a aba Contrato da página de revisão do
// plano mostra. Rodam com o runner nativo do Node, dentro do contêiner `harness`.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const { render } = require('../contract-view.cjs');
const { build } = require('../../.claude/skills/plan-ticket/scripts/page.cjs');
const { panel, snapshot } = require('./helpers.cjs');

const PROBLEM = { $ref: '#/components/schemas/ProblemDetailsDto' };

/** Um erro no formato que o decorator `ApiProblem` gera: o problema com o `code` restrito. */
function problem(...codes) {
  return {
    description: codes.join(', '),
    content: {
      'application/problem+json': {
        schema: { allOf: [PROBLEM], properties: { code: { type: 'string', enum: codes } } },
      },
    },
  };
}

const ME = {
  get: {
    operationId: 'MeController_me',
    responses: {
      200: { description: '', content: { 'application/json': { schema: { $ref: '#/components/schemas/MeDto' } } } },
      401: problem('unauthenticated'),
    },
    security: [{ bearer: [] }],
  },
};

function children(errors) {
  return {
    get: {
      operationId: 'ItemsController_listChildren',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: '' }, ...errors },
      security: [{ bearer: [] }],
    },
  };
}

const COPIES = {
  post: {
    operationId: 'ItemsController_copy',
    summary: 'Copia um item',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } },
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/CopyItemDto' } } },
    },
    responses: {
      201: {
        description: '',
        headers: { Location: { required: true, schema: { type: 'string' } } },
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CopiedItemDto' } } },
      },
      404: problem('not_found'),
      409: problem('name_conflict', 'quota_exceeded'),
    },
    security: [{ bearer: [] }],
  },
};

const NEW_SCHEMAS = {
  CopyItemDto: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      parentId: { type: 'string' },
    },
    required: ['name'],
  },
  CopiedItemDto: {
    type: 'object',
    properties: { id: { type: 'string' }, sizeBytes: { type: 'number' } },
    required: ['id', 'sizeBytes'],
  },
};

/** A seção de uma rota na saída: do título dela até o título da seguinte. */
function block(out, title) {
  const start = out.indexOf(`### ${title}\n`);
  assert.notEqual(start, -1, `a saída não traz "${title}":\n${out}`);
  const end = out.indexOf('\n### ', start + 1);
  return out.slice(start, end === -1 ? undefined : end).trimEnd();
}

/** As linhas de uma seção, juntadas: o texto esperado de uma rota. */
function lines(...rows) {
  return rows.join('\n');
}

const TWO_SNAPSHOTS = [
  snapshot({ '/v1/me': ME, '/v1/items/{id}/children': children({ 404: problem('not_found') }) }),
  snapshot(
    {
      '/v1/me': ME,
      '/v1/items/{id}/children': children({ 404: problem('not_found'), 403: problem('forbidden') }),
      '/v1/items/{id}/copies': COPIES,
    },
    NEW_SCHEMAS,
  ),
];

const COPIES_SECTION = lines(
  '### Rota nova · POST /v1/items/{id}/copies · protegida (bearer)',
  '',
  '#### Parâmetros',
  '',
  '| Nome | Onde | Tipo | Obrigatório | Limites |',
  '| --- | --- | --- | --- | --- |',
  '| `id` | caminho | string | sim |  |',
  '',
  '#### Cabeçalhos de entrada',
  '',
  '| Nome | Tipo | Obrigatório | Limites |',
  '| --- | --- | --- | --- |',
  '| `Idempotency-Key` | string | sim |  |',
  '',
  '#### Corpo (application/json), obrigatório',
  '',
  '- `name`: string, obrigatório, de 1 a 255 caracteres',
  '- `parentId`: string, opcional',
  '',
  '#### Sucesso 201 (application/json)',
  '',
  '- `id`: string, obrigatório',
  '- `sizeBytes`: number, obrigatório',
  '',
  '| Cabeçalho de resposta | Tipo | Obrigatório | Limites |',
  '| --- | --- | --- | --- |',
  '| `Location` | string | sim |  |',
  '',
  '#### Erros',
  '',
  '| Status | `code` |',
  '| --- | --- |',
  '| 404 | `not_found` |',
  '| 409 | `name_conflict`, `quota_exceeded` |',
);

const CHILDREN_SECTION = lines(
  '### Rota alterada · GET /v1/items/{id}/children · protegida (bearer)',
  '',
  '#### Parâmetros',
  '',
  '| Nome | Onde | Tipo | Obrigatório | Limites |',
  '| --- | --- | --- | --- | --- |',
  '| `id` | caminho | string | sim |  |',
  '',
  '#### Sucesso 200 (sem corpo)',
  '',
  '#### Erros',
  '',
  '| Status | `code` |',
  '| --- | --- |',
  '| 403 | `forbidden` |',
  '| 404 | `not_found` |',
);

test('mostra o contrato completo da rota nova e da alterada, e omite a que não mudou', () => {
  const out = render(...TWO_SNAPSHOTS);

  assert.equal(block(out, 'Rota nova · POST /v1/items/{id}/copies · protegida (bearer)'), COPIES_SECTION);
  assert.equal(block(out, 'Rota alterada · GET /v1/items/{id}/children · protegida (bearer)'), CHILDREN_SECTION);
  assert.doesNotMatch(out, /\/v1\/me\b/);
});

test('gera a visão em Markdown, uma seção por rota, com as tabelas de parâmetros, cabeçalhos e erros', () => {
  const [base, head] = TWO_SNAPSHOTS;

  // Uma seção por rota que mudou, na ordem do snapshot novo, e nada da que não mudou.
  assert.equal(render(base, head), `${CHILDREN_SECTION}\n\n${COPIES_SECTION}\n`);

  // O modo `contract` do script de verificação imprime o que a linha de comando do renderizador
  // imprime sobre as fontes, em pares nome e valor terminados por NUL na entrada padrão (`-`), como o
  // `api_contract_view` as escreve: o changelog, esse mesmo Markdown e o diff do schema. Os snapshots
  // vão como o texto dos arquivos.
  const sources = [
    ['base', JSON.stringify(base)],
    ['novo', JSON.stringify(head)],
    ['changelog', 'endpoint added POST /v1/items/{id}/copies\n'],
    ['schemaDiff', ''],
  ];
  const cli = spawnSync(process.execPath, [path.join(__dirname, '..', 'contract-view.cjs'), '-'], {
    input: sources.flat().map((part) => `${part}\0`).join(''),
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(
    cli.stdout,
    [
      '# Contrato',
      '## O que mudou no contrato (oasdiff changelog)',
      '```text\nendpoint added POST /v1/items/{id}/copies\n```',
      '## Contrato completo das rotas novas ou alteradas',
      render(base, head).trimEnd(),
      '# Schema',
      '*O schema do Prisma não muda.*\n',
    ].join('\n\n'),
  );

  // A aba "Contrato" da página mostra esse Markdown, que vem do mesmo modelo: as mesmas rotas, com as
  // mesmas tabelas.
  const tab = panel(build({ ticket: 'PROJ-900', origin: 'Montada da pasta de trabalho.', contract: cli.stdout }), 'contrato');
  const headings = [...tab.matchAll(/<h3>([^<]*)<\/h3>/g)].map((match) => match[1]);
  assert.deepEqual(headings, [
    'Rota alterada · GET /v1/items/{id}/children · protegida (bearer)',
    'Rota nova · POST /v1/items/{id}/copies · protegida (bearer)',
  ]);
  assert.match(tab, /<th>Nome<\/th><th>Onde<\/th><th>Tipo<\/th><th>Obrigatório<\/th><th>Limites<\/th>/);
  assert.match(tab, /<td><code>Idempotency-Key<\/code><\/td><td>string<\/td><td>sim<\/td>/);
  assert.match(tab, /<td><code>Location<\/code><\/td><td>string<\/td><td>sim<\/td>/);
  assert.match(tab, /<td>409<\/td><td><code>name_conflict<\/code>, <code>quota_exceeded<\/code><\/td>/);
  assert.doesNotMatch(tab, /\/v1\/me\b/);
});

test('diz que o contrato não muda quando os snapshots são iguais, inclusive se só o texto mudou', () => {
  const base = snapshot({ '/v1/me': ME });
  const head = snapshot({ '/v1/me': { get: { ...ME.get, summary: 'Quem sou eu', description: 'Texto novo' } } });

  assert.equal(render(base, base).trim(), '*O contrato não muda.*');
  assert.equal(render(base, head).trim(), '*O contrato não muda.*');
});

test('conta como alterada a rota cuja mudança o texto renderizado não mostra', () => {
  const body = (schema) => ({
    post: {
      requestBody: { required: true, content: { 'application/json': { schema } } },
      responses: { 204: { description: '' } },
    },
  });
  const tags = { type: 'object', properties: { tags: { type: 'object' } } };

  const out = render(
    snapshot({ '/v1/tags': body(tags) }),
    snapshot({ '/v1/tags': body({ ...tags, minProperties: 1 }) }),
  );

  assert.match(out, /^### Rota alterada · POST \/v1\/tags · pública$/m);
});

test('conta um campo chamado description como contrato, e não como texto', () => {
  const dto = (properties) => ({ type: 'object', properties });
  const route = {
    get: {
      responses: {
        200: { description: '', content: { 'application/json': { schema: { $ref: '#/components/schemas/TagDto' } } } },
      },
    },
  };

  const out = render(
    snapshot({ '/v1/tag': route }, { TagDto: dto({ name: { type: 'string' }, description: { type: 'string' } }) }),
    snapshot({ '/v1/tag': route }, { TagDto: dto({ name: { type: 'string' } }) }),
  );

  assert.match(out, /^### Rota alterada · GET \/v1\/tag · pública$/m);
});

test('não conta como alterada a rota que só trocou o schema inline por um $ref igual, a ordem das chaves ou o texto de um componente', () => {
  const inline = { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] };
  const route = (schema) => ({
    get: { responses: { 200: { description: '', content: { 'application/json': { schema } } } } },
  });

  const base = snapshot({ '/v1/me': route(inline) });
  const head = snapshot(
    { '/v1/me': route({ $ref: '#/components/schemas/MeDto' }) },
    { MeDto: { required: ['email'], description: 'Quem está logado', properties: { email: { type: 'string', example: 'a@b.c' } }, type: 'object' } },
  );

  assert.equal(render(base, head).trim(), '*O contrato não muda.*');
});

test('mostra a união, cada tipo de conteúdo e a rota e o campo obsoletos', () => {
  const upload = {
    put: {
      deprecated: true,
      parameters: [
        { name: 'ref', in: 'query', required: true, deprecated: true, schema: { oneOf: [{ type: 'string' }, { type: 'integer' }] } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } } },
          'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } },
        },
      },
      responses: {
        200: {
          description: '',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  owner: { anyOf: [{ $ref: '#/components/schemas/MeDto' }, { type: 'string', readOnly: true }] },
                  size: { type: 'integer', minimum: 0, exclusiveMinimum: true, exclusiveMaximum: 10 },
                },
              },
            },
            'application/vnd.app+json': {
              schema: { type: 'object', properties: { owner: { type: 'string' } } },
            },
          },
        },
      },
    },
  };

  const out = render(snapshot({}), snapshot({ '/v1/uploads': upload }));

  assert.equal(
    block(out, 'Rota nova · PUT /v1/uploads · pública'),
    lines(
      '### Rota nova · PUT /v1/uploads · pública',
      '',
      'Obsoleta (deprecated).',
      '',
      '#### Parâmetros',
      '',
      '| Nome | Onde | Tipo | Obrigatório | Limites |',
      '| --- | --- | --- | --- | --- |',
      '| `ref` | consulta | string ou integer | sim | obsoleto |',
      '',
      '#### Corpo (application/json), obrigatório',
      '',
      '- `name`: string, opcional',
      '',
      '#### Corpo (multipart/form-data), obrigatório',
      '',
      '- `file`: string (binary), opcional',
      '',
      '#### Sucesso 200 (application/json)',
      '',
      '- `owner`: MeDto ou string, opcional',
      '  - Opção MeDto:',
      '    - `email`: string, obrigatório',
      '- `size`: integer, opcional, maior que 0, menor que 10',
      '',
      '#### Sucesso 200 (application/vnd.app+json)',
      '',
      '- `owner`: string, opcional',
    ),
  );
});

test('junta os tipos de conteúdo com o mesmo schema numa linha só', () => {
  const schema = { type: 'object', properties: { name: { type: 'string' } } };
  const route = {
    post: {
      requestBody: { content: { 'application/json': { schema }, 'application/x-www-form-urlencoded': { schema } } },
      responses: { 204: { description: '' } },
    },
  };

  const out = render(snapshot({}), snapshot({ '/v1/names': route }));

  assert.match(out, /^#### Corpo \(application\/json, application\/x-www-form-urlencoded\), opcional\n\n- `name`: string, opcional$/m);
});

test('põe o default nos erros, depois dos status, com os status em ordem numérica', () => {
  const route = {
    get: {
      responses: {
        default: problem('internal'),
        500: problem('unavailable'),
        '4XX': problem('bad_request'),
        404: problem('not_found'),
        200: { description: '' },
      },
    },
  };

  const out = render(snapshot({}), snapshot({ '/v1/ping': route }));

  assert.equal(
    block(out, 'Rota nova · GET /v1/ping · pública'),
    lines(
      '### Rota nova · GET /v1/ping · pública',
      '',
      '#### Sucesso 200 (sem corpo)',
      '',
      '#### Erros',
      '',
      '| Status | `code` |',
      '| --- | --- |',
      '| 404 | `not_found` |',
      '| 4XX | `bad_request` |',
      '| 500 | `unavailable` |',
      '| default | `internal` |',
    ),
  );
});

test('usa o parâmetro da operação no lugar do parâmetro do caminho com o mesmo nome e o mesmo in', () => {
  const out = render(
    snapshot({}),
    snapshot({
      '/v1/items/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'id', in: 'query', schema: { type: 'string' } },
        ],
        get: {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 204: { description: '' } },
        },
      },
    }),
  );

  assert.equal(
    block(out, 'Rota nova · GET /v1/items/{id} · pública'),
    lines(
      '### Rota nova · GET /v1/items/{id} · pública',
      '',
      '#### Parâmetros',
      '',
      '| Nome | Onde | Tipo | Obrigatório | Limites |',
      '| --- | --- | --- | --- | --- |',
      '| `id` | caminho | integer | sim |  |',
      '| `id` | consulta | string | não |  |',
      '',
      '#### Sucesso 204 (sem corpo)',
    ),
  );
});

test('lê o corpo obrigatório através do $ref do requestBody', () => {
  const rename = {
    patch: {
      requestBody: { $ref: '#/components/requestBodies/Rename' },
      responses: { 204: { description: '' } },
    },
  };
  const head = snapshot({ '/v1/items/{id}': rename });
  head.components.requestBodies = {
    Rename: {
      required: true,
      content: {
        'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
      },
    },
  };

  const out = render(snapshot({}), head);

  assert.match(out, /^#### Corpo \(application\/json\), obrigatório\n\n- `name`: string, obrigatório$/m);
});

test('lista a rota removida, sem o contrato dela', () => {
  const out = render(snapshot({ '/v1/me': ME }), snapshot({}));

  assert.equal(out.trim(), '### Rota removida · GET /v1/me');
});

test('expande o objeto aninhado e a lista de objetos, com o tipo, o nulo e os limites', () => {
  const list = {
    get: {
      parameters: [
        { name: 'limit', in: 'query', required: false, schema: { type: 'number', minimum: 1, maximum: 200, default: 50 } },
      ],
      responses: {
        200: {
          description: '',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: '#/components/schemas/ItemDto' } },
                  nextCursor: { type: 'string', nullable: true },
                },
                required: ['items', 'nextCursor'],
              },
            },
          },
        },
      },
    },
  };
  const ItemDto = {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['file', 'folder'] },
      updatedAt: { type: 'string', format: 'date-time' },
    },
    required: ['type'],
  };

  const out = render(snapshot({}), snapshot({ '/v1/items': list }, { ItemDto }));

  assert.equal(
    block(out, 'Rota nova · GET /v1/items · pública'),
    lines(
      '### Rota nova · GET /v1/items · pública',
      '',
      '#### Parâmetros',
      '',
      '| Nome | Onde | Tipo | Obrigatório | Limites |',
      '| --- | --- | --- | --- | --- |',
      '| `limit` | consulta | number | não | mínimo 1, máximo 200, padrão 50 |',
      '',
      '#### Sucesso 200 (application/json)',
      '',
      '- `items`: array de objeto, obrigatório',
      '  - `type`: string ("file" | "folder"), obrigatório',
      '  - `updatedAt`: string (date-time), opcional',
      '- `nextCursor`: string, obrigatório, aceita null',
    ),
  );
});

test('escapa a barra vertical do tipo dentro da tabela e mostra os cabeçalhos dos erros numa coluna', () => {
  const route = {
    get: {
      parameters: [{ name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'size'] } }],
      responses: {
        200: { description: '' },
        429: { ...problem('rate_limited'), headers: { 'Retry-After': { required: true, schema: { type: 'integer' } } } },
      },
    },
  };

  const out = render(snapshot({}), snapshot({ '/v1/search': route }));

  assert.match(out, /^\| `sort` \| consulta \| string \("name" \\\| "size"\) \| não \| {2}\|$/m);
  assert.match(out, /^\| Status \| `code` \| Cabeçalhos \|\n\| --- \| --- \| --- \|\n\| 429 \| `rate_limited` \| `Retry-After`: integer, obrigatório \|$/m);
});
