import { type CategoryParams, NATURES } from '../../_shell/category-text';
import { requestedPage } from '../../_shell/list-page';
import { firstParam as first } from '../../_shell/search-params';

/**
 * O estado da tela Categorias lido do endereço (`categoriesHref` escreve o mesmo): a aba de despesa, sem
 * busca, na primeira página e com as desativadas, no que faltar.
 */
export function categoryParams(search: Readonly<Record<string, string | string[] | undefined>>): CategoryParams {
  const nature = first(search.nature);
  return {
    nature: NATURES.find((option) => option === nature) ?? 'expense',
    q: first(search.q) ?? '',
    page: requestedPage(search.page),
    showInactive: first(search.active) !== 'true',
  };
}
