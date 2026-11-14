'use client';

/** O texto do gerir acessos, o mesmo do detalhe e do cadastro (protótipo Usuarios). */
const MANAGES_ACCESS_LABEL = 'Gere acessos: cadastra usuários, define permissões e gera links de recuperação';

/**
 * A caixa do gerir acessos (regra 6.1). Com o motivo dado, ela fica desabilitada, como para o próprio
 * usuário, que não tira de si mesmo o gerir acessos.
 */
export function ManagesAccessField({
  checked,
  onChange,
  name,
  disabledNote = null,
}: Readonly<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** O nome do campo, quando a caixa vai no envio de um formulário. */
  name?: string;
  disabledNote?: string | null;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label className={`flex items-start gap-3 text-ink ${disabledNote ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabledNote !== null}
          aria-describedby={disabledNote ? 'manages-access-note' : undefined}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="mt-1 size-4 flex-none accent-accent"
        />
        <span>{MANAGES_ACCESS_LABEL}</span>
      </label>
      {disabledNote && (
        <p id="manages-access-note" className="pl-7 text-body-sm text-mute">
          {disabledNote}
        </p>
      )}
    </div>
  );
}
