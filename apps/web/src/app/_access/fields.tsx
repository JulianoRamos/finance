'use client';

import { type ReactNode, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { FOCUS_RING } from './access-screen';
import { Icon } from './icon';

const INPUT = `h-11 w-full rounded-sm border border-field-border bg-surface px-3 text-body-lg text-ink hover:border-body aria-invalid:border-negative-strong md:text-body-md ${FOCUS_RING}`;

interface FieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly autoComplete: string;
  /** O texto de ajuda, sempre visível abaixo do campo. */
  readonly help?: string;
  /** O motivo da recusa, abaixo do campo. */
  readonly error?: string | undefined;
}

/** O rótulo, o campo, a ajuda e o erro (design-system.md, seção 4.3), com o que vai à direita do campo. */
function Field({
  id,
  name,
  label,
  autoComplete,
  help,
  error,
  type,
  defaultValue,
  trailing,
}: FieldProps & { readonly type: string; readonly defaultValue?: string; readonly trailing?: ReactNode }) {
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <div className="relative flex">
        <input
          id={id}
          name={name}
          type={type}
          required
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={trailing ? `${INPUT} pr-10` : INPUT}
        />
        {trailing}
      </div>
      {help && (
        <p id={`${id}-help`} className="text-body-sm text-mute">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-body-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/** Um campo de e-mail. */
export function EmailField(props: FieldProps & { readonly defaultValue: string }) {
  return <Field {...props} type="email" />;
}

/** Um campo de senha, com o botão de mostrar o que foi digitado. */
export function PasswordField({ showLabel, ...props }: FieldProps & { readonly showLabel: string }) {
  const [shown, setShown] = useState(false);
  const toggle = (
    <button
      type="button"
      aria-label={showLabel}
      aria-pressed={shown}
      onClick={() => {
        setShown((current) => !current);
      }}
      className={`absolute inset-y-1 right-1 flex w-8 items-center justify-center rounded-sm text-body hover:bg-surface-subtle ${FOCUS_RING}`}
    >
      <Icon>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {shown && <path d="M3 3l18 18" />}
      </Icon>
    </button>
  );
  return <Field {...props} type={shown ? 'text' : 'password'} trailing={toggle} />;
}

/** O botão principal do formulário, que não aceita outro clique enquanto o envio corre. */
export function SubmitButton({ children }: Readonly<{ children: ReactNode }>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`h-11 rounded-sm bg-primary text-label text-on-primary hover:bg-primary-hover disabled:cursor-wait ${FOCUS_RING}`}
    >
      {children}
    </button>
  );
}

/** O aviso de erro na página (design-system.md, seção 4.5). */
export function ErrorNotice({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-negative-strong bg-negative-soft px-4 py-3 text-ink"
    >
      <Icon className="mt-1 flex-none text-negative">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </Icon>
      <span>{children}</span>
    </div>
  );
}
