/** O painel de um menu (design-system.md, seção 4.5): nível 2, raio `radius-md`. */
export const MENU_PANEL =
  'z-30 flex w-menu flex-col gap-1 rounded-md border border-hairline bg-surface p-1 shadow-flutuante';

/** Um item de menu de 36px, destacado pelo teclado ou pelo ponteiro. */
export const MENU_ITEM =
  'flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-ink outline-none data-highlighted:bg-surface-subtle';

/** Um item de menu destrutivo, por último no menu, em `negative` (design-system.md, seção 4.5). */
export const MENU_ITEM_DESTRUCTIVE = `${MENU_ITEM} text-negative`;

/** A divisória entre os grupos de um menu. */
export const MENU_SEPARATOR = 'h-px bg-hairline';
