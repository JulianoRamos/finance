/**
 * O endereço da página com um parâmetro trocado e os outros mantidos, como a página da tabela ao lado da
 * data do saldo.
 */
export function withSearchParam(
  pathname: string,
  searchParams: { toString(): string },
  key: string,
  value: string,
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

/** O primeiro valor de um parâmetro do endereço, como o Next ou o `URLSearchParams` o dão. */
export function firstParam(value: string | string[] | null | undefined): string | undefined {
  if (value === null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
