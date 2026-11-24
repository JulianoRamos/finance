'use client';

import { type ChangeEvent, type ReactNode, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { PRIMARY_BUTTON } from '../_shell/buttons';
import { FOCUS_RING } from './access-screen';
import { Icon } from './icon';

/**
 * O tamanho dos controles: o das telas de acesso, de 44px (design-system.md, seção 4.1), ou o da
 * estrutura do app, com o campo de 40px no celular e 36px a partir do tablet (seção 4.3) e os botões
 * de `_shell/buttons.ts` (seção 4.2).
 */
export type ControlSize = 'access' | 'app';

const INPUT_HEIGHT: Record<ControlSize, string> = { access: 'h-11', app: 'h-10 md:h-9' };

/** A aparência comum dos campos: a borda, o fundo, o texto, o erro e o foco. */
const CONTROL = `w-full rounded-sm border border-field-border bg-surface px-3 text-body-lg text-ink hover:border-body aria-invalid:border-negative-strong md:text-body-md ${FOCUS_RING}`;

/** A aparência de um campo de texto do tamanho dado, também para um campo fora de `Field`, como a busca. */
export function inputClass(size: ControlSize): string {
  return `${CONTROL} ${INPUT_HEIGHT[size]}`;
}

/** O botão principal das telas de acesso, de 44px; o do app é o `PRIMARY_BUTTON`. */
const ACCESS_PRIMARY_BUTTON = `h-11 rounded-sm bg-primary px-3 text-label text-on-primary hover:bg-primary-hover disabled:cursor-wait ${FOCUS_RING}`;

interface FieldProps {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly autoComplete: string;
  /** O texto de ajuda, sempre visível abaixo do campo. */
  readonly help?: string;
  /** O motivo da recusa, abaixo do campo. */
  readonly error?: string | undefined;
  /** O tamanho do campo; o padrão é o das telas de acesso. */
  readonly size?: ControlSize;
  /** Se o campo é obrigatório; o padrão é que seja. */
  readonly required?: boolean;
  readonly placeholder?: string | undefined;
  readonly inputMode?: 'decimal' | 'numeric' | 'text';
  /** O valor controlado e quem o recebe a cada mudança, quando a tela usa o que é digitado. */
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
}

/** O motivo da recusa, abaixo do campo ou do grupo de campos. */
export function FieldError({ id, error }: Readonly<{ id: string; error: string | undefined }>) {
  if (!error) return null;
  return (
    <p id={id} className="text-body-sm text-negative">
      {error}
    </p>
  );
}

/** Os atributos do controle que o rótulo, a ajuda e o erro de `FieldFrame` pedem. */
function controlProps({
  id,
  name,
  autoComplete,
  help,
  error,
  required = true,
  placeholder,
  value,
  onValueChange,
}: FieldProps) {
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return {
    id,
    name,
    required,
    placeholder,
    autoComplete,
    value,
    onChange:
      onValueChange &&
      ((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onValueChange(event.currentTarget.value);
      }),
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };
}

/** O rótulo, a ajuda e o erro em volta do controle (design-system.md, seção 4.3). */
function FieldFrame({
  id,
  label,
  help,
  error,
  children,
}: Readonly<Pick<FieldProps, 'id' | 'label' | 'help' | 'error'> & { children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <div className="relative flex">{children}</div>
      {help && (
        <p id={`${id}-help`} className="text-body-sm text-mute">
          {help}
        </p>
      )}
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

/** Um campo de uma linha, do tipo dado, com o que vai à direita dele. */
function Field({
  type,
  defaultValue,
  trailing,
  size = 'access',
  inputMode,
  ...props
}: FieldProps & { readonly type: string; readonly defaultValue?: string; readonly trailing?: ReactNode }) {
  return (
    <FieldFrame {...props}>
      <input
        {...controlProps(props)}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        className={`${inputClass(size)} ${trailing ? 'pr-10' : ''}`}
      />
      {trailing}
    </FieldFrame>
  );
}

/** Um campo de texto. */
export function TextField(props: FieldProps & { readonly defaultValue?: string }) {
  return <Field {...props} type="text" />;
}

/** Um campo de texto de várias linhas, com as linhas visíveis dadas. */
export function TextAreaField({
  rows,
  defaultValue,
  ...props
}: FieldProps & { readonly defaultValue?: string; readonly rows: number }) {
  return (
    <FieldFrame {...props}>
      <textarea
        {...controlProps(props)}
        rows={rows}
        defaultValue={defaultValue}
        className={`${CONTROL} resize-y py-2`}
      />
    </FieldFrame>
  );
}

/** Um campo de data, com o calendário do navegador, que envia a data como `AAAA-MM-DD`. */
export function DateField(props: FieldProps & { readonly defaultValue?: string }) {
  return <Field {...props} type="date" />;
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
export function SubmitButton({ size = 'access', children }: Readonly<{ size?: ControlSize; children: ReactNode }>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={size === 'app' ? PRIMARY_BUTTON : ACCESS_PRIMARY_BUTTON}
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
