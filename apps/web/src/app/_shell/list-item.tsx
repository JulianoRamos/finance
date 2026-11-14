// O item da Coluna das telas com a lista ao lado (design-system.md, seção 4.1).

/** O item da lista. */
export const LIST_ITEM = 'flex flex-col gap-1 rounded-sm px-3 py-2';

/** O item aberto, marcado. */
export const LIST_ITEM_SELECTED = 'bg-accent-soft ring-1 ring-accent ring-inset';

/** O item do registro em criação, marcado no topo da lista: o nome da ação e "Ainda não salvo". */
export function NewListItem({ label, detail }: Readonly<{ label: string; detail: string }>) {
  return (
    <li aria-current="true" className={`${LIST_ITEM} ${LIST_ITEM_SELECTED} text-ink`}>
      <span className="font-medium">{label}</span>
      <span className="text-body-sm">{detail}</span>
    </li>
  );
}
