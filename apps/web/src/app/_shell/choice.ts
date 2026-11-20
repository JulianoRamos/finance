// A escolha de um formulário (design-system.md, seção 4.3): o rádio ou a caixa num cartão, com o nome e a
// descrição, marcado em `accent-soft`.

/** O cartão da escolha, que contém o controle e os textos. */
export const CHOICE = `flex cursor-pointer items-start gap-3 rounded-md border border-hairline p-3 hover:border-hairline-strong has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent`;

/** O rádio ou a caixa dentro do cartão. */
export const CHOICE_CONTROL = 'mt-1 size-4 flex-none accent-accent outline-none';
