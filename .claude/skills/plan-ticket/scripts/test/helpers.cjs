// Auxiliares dos testes da página do plano. Não termina em `.test.cjs`, então o `node --test` não o
// roda como teste.

const assert = require('node:assert/strict');

/** O conteúdo de uma aba da página: o painel com o id dela, até o fim dele. */
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

module.exports = { panel, text };
