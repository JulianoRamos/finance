import { FOCUS_RING } from '../_access/access-screen';

// Os botões da estrutura do app (design-system.md, seção 4.2), de 32px no desktop e 40px no celular, para botões e
// links com a aparência de botão.

const BASE = `inline-flex h-10 md:h-8 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-label ${FOCUS_RING}`;

/** O principal: a ação principal da área. */
export const PRIMARY_BUTTON = `${BASE} bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-wait`;

/** O secundário: as outras ações. */
export const SECONDARY_BUTTON = `${BASE} border border-hairline-strong bg-surface text-ink hover:bg-surface-subtle`;

/** O fantasma: sem fundo nem borda, para as ações que não são a principal da área. */
export const GHOST_BUTTON = `${BASE} text-body hover:bg-surface-subtle`;

/** O destrutivo: a ação que a confirmação repete. */
export const DESTRUCTIVE_BUTTON = `${BASE} bg-negative-strong text-on-negative`;
