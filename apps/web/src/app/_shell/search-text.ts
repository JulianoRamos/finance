// O casamento do termo da paleta com os nomes, como a api o faz (LLD, regra 6.22): em qualquer posição, sem
// acento nem diferença de maiúsculas. A web o usa nos destinos e nas ações, que não passam pela api, e no
// trecho destacado de cada resultado.

/** O menor termo que vai à api; com menos, a paleta mostra as sugestões (design-system.md, seção 4.5). */
export const MIN_TERM_LENGTH = 2;

/** O maior termo que a api aceita, o limite do nome (LLD, regra 6.22). */
export const MAX_TERM_LENGTH = 120;

/**
 * O texto sem acento e em minúsculas, com o começo e o fim, no texto original, do caractere de onde veio
 * cada caractere dele.
 */
function fold(text: string): { readonly folded: string; readonly starts: number[]; readonly ends: number[] } {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of text) {
    for (const plain of char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) {
      folded += plain;
      starts.push(offset);
      ends.push(offset + char.length);
    }
    offset += char.length;
  }
  return { folded, starts, ends };
}

/** O nome dividido em volta do trecho que casa com o termo, para destacá-lo. */
export interface Highlighted {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

/** O trecho do nome que casa com o termo, aparado; nulo quando não casa ou o termo é vazio. */
export function highlight(name: string, term: string): Highlighted | null {
  const needle = fold(term.trim()).folded;
  if (needle === '') return null;
  const { folded, starts, ends } = fold(name);
  const at = folded.indexOf(needle);
  if (at < 0) return null;
  const start = starts[at] ?? 0;
  const end = ends[at + needle.length - 1] ?? start;
  return { before: name.slice(0, start), match: name.slice(start, end), after: name.slice(end) };
}
