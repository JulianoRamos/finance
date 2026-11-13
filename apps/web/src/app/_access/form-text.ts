/** O texto de um campo do formulário enviado, ou vazio quando ele falta ou é um arquivo. */
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
