// Auxiliares dos testes do harness deste projeto: o renderizador do contrato e o aceite da skill de
// plano (a página e o parser, testados aqui pelos módulos da skill). Não termina em `.test.cjs`,
// então o `node --test` não o roda como teste.

const assert = require('node:assert/strict');

/** Um snapshot da OpenAPI com as rotas dadas, o esquema `bearer`, o problema e o `MeDto`. */
function snapshot(paths, schemas = {}) {
  return {
    openapi: '3.0.0',
    info: { title: 'API', version: '1' },
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      schemas: {
        ProblemDetailsDto: {
          type: 'object',
          properties: { type: { type: 'string' }, code: { type: 'string' } },
          required: ['type', 'code'],
        },
        MeDto: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
        ...schemas,
      },
    },
  };
}

/** O conteúdo de uma aba da página do plano: o painel com o id dela, até o fim dele. */
function panel(html, id) {
  const start = html.indexOf(`<section class="painel" id="aba-${id}"`);
  assert.notEqual(start, -1, `a página não tem a aba ${id}`);
  return html.slice(start, html.indexOf('</section>', start));
}

/** O texto visível de um trecho de HTML, sem as marcas e com as entidades desfeitas. */
function text(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { snapshot, panel, text };
