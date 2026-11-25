/**
 * O Conteúdo enquanto o detalhe ou o formulário carrega: blocos cinza no formato dele, e não um indicador
 * girando (design-system.md, seção 4.5).
 */
export default function LoadingEntry() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando o lançamento"
      className="flex flex-col gap-6 rounded-md border border-hairline bg-surface p-4 md:p-6"
    >
      <div className="h-7 w-1/3 rounded-sm bg-surface-subtle" />
      <div className="h-5 w-1/2 rounded-sm bg-surface-subtle" />
      <div className="h-24 rounded-md bg-surface-subtle" />
    </div>
  );
}
