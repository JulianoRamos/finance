import type { Movement, MovementPage } from '@/api/accounts';

import { formatCalendarDate } from '../../../_shell/format';
import { MoneyValue } from '../../../_shell/money-value';
import { UrlPagination } from '../../../_shell/url-pagination';
import { type DatedBalance, NewAdjustment } from './new-adjustment';
import { NewMovement } from './new-movement';

const HEAD = 'py-2 text-label text-mute';
const CELL = 'border-t border-hairline py-2';

/** O nome de cada origem de movimentação, como a tela a mostra. */
const SOURCE_NAMES: Readonly<Record<Movement['source'], string>> = { manual: 'Manual', adjustment: 'Ajuste' };

/** A descrição como a tela a mostra: a do ajuste, que é o motivo dele, vem depois de "Ajuste:", como o protótipo. */
function shownDescription(movement: Movement): string {
  return movement.source === 'adjustment' ? `Ajuste: ${movement.description}` : movement.description;
}

/**
 * A seção "Movimentações" do detalhe da conta: a tabela da data, da descrição, da origem e do valor, de 10
 * em 10, com a página no endereço, e o "Ajustar saldo" e o "Nova movimentação", que a conta desativada não tem. Abaixo de
 * `container-table`, como no celular, a tabela vira a lista estreita, com a descrição e o valor na
 * primeira linha e a data e a origem na segunda (design-system.md, seção 4.4).
 */
export function Movements({
  account,
  movements,
  today,
  balanceOn,
}: Readonly<{
  account: { readonly id: string; readonly name: string; readonly active: boolean };
  movements: MovementPage;
  /** A data de hoje, `AAAA-MM-DD`, que o diálogo da movimentação traz de partida. */
  today: string;
  /** O "Saldo em" da página, a data e o saldo dela, que o diálogo do ajuste traz de partida. */
  balanceOn: DatedBalance;
}>) {
  const caption = `Movimentações da conta ${account.name}`;
  return (
    <section aria-labelledby="movements-title" className="flex flex-col gap-3 border-t border-hairline pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="movements-title" className="text-heading-sm text-ink">
          Movimentações
        </h3>
        {account.active && (
          <div className="flex flex-wrap gap-2">
            <NewAdjustment accountId={account.id} accountName={account.name} balanceOn={balanceOn} />
            <NewMovement accountId={account.id} accountName={account.name} today={today} />
          </div>
        )}
      </div>
      {movements.total === 0 ? (
        <p className="text-body-sm text-mute">Nenhuma movimentação registrada.</p>
      ) : (
        <div className="@container">
          <ul aria-label={caption} className="flex flex-col @table:hidden">
            {movements.items.map((movement) => (
              <li key={movement.id} className="flex flex-col gap-1 border-t border-hairline py-2">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 wrap-anywhere text-ink">{shownDescription(movement)}</span>
                  <MoneyValue amount={movement.amount} direction={movement.direction} />
                </span>
                <span className="text-body-sm text-mute tabular-nums">
                  {formatCalendarDate(movement.date)} · {SOURCE_NAMES[movement.source]}
                </span>
              </li>
            ))}
          </ul>
          <table className="hidden w-full border-collapse @table:table">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${HEAD} text-left`}>
                  Data
                </th>
                <th scope="col" className={`${HEAD} text-left`}>
                  Descrição
                </th>
                <th scope="col" className={`${HEAD} text-left`}>
                  Origem
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.items.map((movement) => (
                <tr key={movement.id}>
                  <td className={`${CELL} pr-4 whitespace-nowrap tabular-nums`}>{formatCalendarDate(movement.date)}</td>
                  <td className={`${CELL} pr-4 wrap-anywhere text-ink`}>{shownDescription(movement)}</td>
                  <td className={`${CELL} pr-4`}>{SOURCE_NAMES[movement.source]}</td>
                  <td className={`${CELL} text-right`}>
                    <MoneyValue amount={movement.amount} direction={movement.direction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {movements.total > movements.pageSize && <UrlPagination page={movements} label="Paginação das movimentações" />}
    </section>
  );
}
