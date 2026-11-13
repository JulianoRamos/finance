/** As iniciais do nome: a primeira letra do primeiro e a do último nome. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** O avatar do usuário, com as iniciais, decorativo: o nome vai no texto ou no rótulo do botão. */
export function Avatar({ name }: Readonly<{ name: string }>) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-hairline text-body-sm font-medium text-ink"
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * O nome e o e-mail do usuário, um em cada linha, cortados com reticências. O tom do e-mail muda sobre
 * um fundo em que o `mute` não alcança o contraste mínimo.
 */
export function UserLines({
  name,
  email,
  emailTone = 'text-mute',
}: Readonly<{ name: string; email: string; emailTone?: string }>) {
  return (
    <span className="flex min-w-0 flex-col text-left">
      <span className="truncate font-medium text-ink">{name}</span>
      <span className={`truncate text-body-sm ${emailTone}`}>{email}</span>
    </span>
  );
}
