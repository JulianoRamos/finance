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
