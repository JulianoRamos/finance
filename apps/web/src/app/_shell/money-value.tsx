import { formatFlow, formatMoney } from './money';

/**
 * O Valor (design-system.md, seção 4.4): o dinheiro com o sinal, a cor, os centavos e os números
 * tabulares da seção 3. Um saldo, sem sentido, sai em `ink`, e em `negative` só quando é negativo, com o
 * sinal de menos. Uma movimentação, com o sentido, sai em `positive` com `+` na entrada e em `ink` com `−`
 * na saída, e o leitor de tela ouve "Entrada:" ou "Saída:" antes, porque o sinal sozinho não diz o
 * sentido.
 */
export function MoneyValue({
  amount,
  direction,
  className = '',
}: Readonly<{
  /** A string decimal da api. */
  amount: string;
  /** O sentido de uma movimentação; sem ele, o valor é um saldo. */
  direction?: 'inflow' | 'outflow';
  className?: string;
}>) {
  if (direction === undefined) {
    const color = amount.startsWith('-') ? 'text-negative' : 'text-ink';
    return <span className={`whitespace-nowrap tabular-nums ${color} ${className}`}>{formatMoney(amount)}</span>;
  }
  const inflow = direction === 'inflow';
  return (
    <span className={`whitespace-nowrap tabular-nums ${inflow ? 'text-positive' : 'text-ink'} ${className}`}>
      <span className="sr-only">{inflow ? 'Entrada: ' : 'Saída: '}</span>
      <span aria-hidden="true">{formatFlow(amount, direction)}</span>
    </span>
  );
}
