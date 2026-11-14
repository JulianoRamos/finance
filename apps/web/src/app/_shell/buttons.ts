import { FOCUS_RING } from '../_access/access-screen';

// Os botões da estrutura do app (design-system.md, seção 4.2), de 36px no desktop, a altura do campo, e 40px no
// celular, para botões e links com a aparência de botão.

const BASE = `inline-flex h-10 md:h-9 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-label ${FOCUS_RING}`;

/** O principal: a ação principal da área. */
export const PRIMARY_BUTTON = `${BASE} bg-primary text-on-primary hover:bg-primary-hover disabled:cursor-wait`;

/** O secundário: as outras ações. */
export const SECONDARY_BUTTON = `${BASE} border border-hairline-strong bg-surface text-ink hover:bg-surface-subtle`;

/** O fantasma: sem fundo nem borda, para as ações que não são a principal da área. */
export const GHOST_BUTTON = `${BASE} text-body hover:bg-surface-subtle`;

/** O destrutivo: a ação que a confirmação repete. */
export const DESTRUCTIVE_BUTTON = `${BASE} bg-negative-strong text-on-negative`;

/** O fantasma destrutivo: a ação que tira algo, à esquerda do rodapé da edição, que abre a confirmação. */
export const GHOST_DESTRUCTIVE_BUTTON = `${BASE} text-negative hover:bg-negative-soft`;

/**
 * O botão de ícone fantasma, das ações de linha e da barra superior: o ícone no centro, sem fundo nem
 * borda, sempre com o `aria-label` e a dica. Quem usa dá o tamanho e o `display`.
 */
export const GHOST_ICON_BUTTON = `flex-none cursor-pointer items-center justify-center rounded-sm text-body hover:bg-surface-subtle ${FOCUS_RING}`;

/**
 * O botão de ícone secundário: um quadrado do tamanho do botão, com o ícone no centro, sempre com o
 * `aria-label` e a dica. Desabilitado, o ícone fica em `faint`.
 */
export const SECONDARY_ICON_BUTTON = `inline-flex size-10 md:size-9 flex-none cursor-pointer items-center justify-center rounded-sm border border-hairline-strong bg-surface text-ink hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-surface ${FOCUS_RING}`;
