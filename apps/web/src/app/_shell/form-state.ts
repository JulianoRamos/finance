import { redirect } from 'next/navigation';

import type { ApiError } from '@/api/api-error';

/** O que um formulário com ação mostra depois de um envio recusado. */
export interface FormState<Values> {
  /**
   * O que foi enviado, ou nulo antes do primeiro envio. O React limpa o formulário depois de cada envio
   * com ação, e os campos voltam a estes valores.
   */
  readonly values: Values | null;
  /** A recusa que não é de um campo, como a versão desatualizada ou a api fora do ar. */
  readonly message: string | null;
  /** Se a recusa foi pela versão desatualizada, que pede para recarregar o registro. */
  readonly conflict: boolean;
  /** O motivo da recusa de cada campo, pelo nome dele no contrato. */
  readonly fields: Readonly<Record<string, string>>;
}

/** O formulário antes do primeiro envio. */
export const INITIAL_FORM_STATE: FormState<never> = { values: null, message: null, conflict: false, fields: {} };

/**
 * A recusa da api para o formulário: sem sessão, vai para o login; a de um campo que ele mostra vai para
 * o campo, e as outras para o aviso. O corpo de erro só traz `fields` na entrada inválida (LLD, seção 5),
 * então a recusa de regra que é de um campo chega pelo código, ligado ao campo em `fieldOfCode`.
 */
export function refusedFormState<Values>(
  error: ApiError,
  values: Values,
  shown: ReadonlySet<string>,
  fieldOfCode: Readonly<Record<string, string>>,
): FormState<Values> {
  if (error.code === 'UNAUTHENTICATED') redirect('/login');
  const ruleField = fieldOfCode[error.code];
  const fields = error.fields ?? (ruleField ? { [ruleField]: error.message } : {});
  // Um campo que o formulário não mostra, como a versão oculta, não pode recusar sem dizer nada.
  const placed = Object.keys(fields).length > 0 && Object.keys(fields).every((field) => shown.has(field));
  return { values, message: placed ? null : error.message, conflict: error.code === 'VERSION_CONFLICT', fields };
}
