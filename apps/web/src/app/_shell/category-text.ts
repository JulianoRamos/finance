// O texto das naturezas das categorias e o endereço da tela Categorias, que a tela e a paleta de pesquisa
// usam: a paleta abre a árvore da natureza da categoria, já na busca pelo nome (LLD, regra 6.22).

/** A natureza de uma categoria, e de uma aba da árvore. */
export type Nature = 'expense' | 'revenue';

/** As naturezas, na ordem das abas. */
export const NATURES: readonly Nature[] = ['expense', 'revenue'];

/** Como a tela escreve cada natureza: o nome da aba, o rótulo da escolha e o adjetivo das frases. */
export const NATURE_TEXT: Readonly<
  Record<Nature, { readonly tab: string; readonly label: string; readonly adjective: string }>
> = {
  expense: { tab: 'Despesas', label: 'Despesa', adjective: 'despesa' },
  revenue: { tab: 'Receitas', label: 'Receita', adjective: 'receita' },
};

/** O estado da tela Categorias, que fica no endereço. */
export interface CategoryParams {
  readonly nature: Nature;
  readonly q: string;
  readonly page: number;
  /** Falso quando o "Mostrar desativadas" está desmarcado (`?active=true`). */
  readonly showInactive: boolean;
}

/** O estado de partida: a aba de despesa, sem busca, na primeira página, com as desativadas. */
const DEFAULT_PARAMS: CategoryParams = { nature: 'expense', q: '', page: 1, showInactive: true };

/** O endereço da tela no estado dado, sobre o de partida, só com o que não é o padrão. */
export function categoriesHref(changes: Partial<CategoryParams>): string {
  const params = { ...DEFAULT_PARAMS, ...changes };
  const query = new URLSearchParams();
  if (params.nature !== DEFAULT_PARAMS.nature) query.set('nature', params.nature);
  if (params.q !== '') query.set('q', params.q);
  if (params.page > 1) query.set('page', String(params.page));
  if (!params.showInactive) query.set('active', 'true');
  const text = query.toString();
  return text === '' ? '/categories' : `/categories?${text}`;
}
