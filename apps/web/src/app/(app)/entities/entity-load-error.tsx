import { ErrorNotice } from '../../_access/fields';

/** O painel do Conteúdo quando a api não devolveu a entidade, no detalhe e na edição. */
export function EntityLoadError() {
  return (
    <div className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6">
      <ErrorNotice>Não foi possível carregar a entidade.</ErrorNotice>
    </div>
  );
}
