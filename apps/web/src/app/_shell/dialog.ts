// O diálogo (design-system.md, seção 4.5): sobre a página escurecida a 40%, centralizado a partir do
// tablet, com até 560px, e uma folha que sobe do rodapé no celular, com o puxador no topo.

/** O fundo escurecido atrás do diálogo. */
export const DIALOG_OVERLAY = 'fixed inset-0 z-40 bg-ink/40';

/** O diálogo: a folha no celular e o diálogo centralizado a partir do tablet. Quem usa dá o `flex` e o espaço. */
export const DIALOG_SHEET =
  'fixed inset-x-0 bottom-0 z-50 w-full rounded-t-lg border-t border-hairline bg-surface px-4 pt-2 pb-safe shadow-flutuante md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:max-w-section md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:p-6';

/** O puxador da folha, só no celular. */
export const SHEET_HANDLE = 'h-1 w-9 flex-none self-center rounded-full bg-hairline-strong md:hidden';
