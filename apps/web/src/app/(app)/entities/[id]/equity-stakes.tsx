'use client';

import { useState } from 'react';

import type { EquityStake } from '@/api/equity-stakes';

import { FOCUS_RING } from '../../../_access/access-screen';
import { SECONDARY_BUTTON } from '../../../_shell/buttons';
import { formatFraction } from '../../../_shell/format';
import type { ListPage } from '../../../_shell/list-page';
import { UrlPagination } from '../../../_shell/url-pagination';
import { EntityBadge } from '../entity-badge';
import type { EntityOption } from '../entity-option';
import { EndEquityStakeForm } from './end-equity-stake-form';
import { EquityStakeForm } from './equity-stake-form';
import { periodText } from './equity-stake-view';

const HEAD = 'py-2 text-label text-mute';
const CELL = 'border-t border-hairline py-2';
/** O botão de linha de 28px (design-system.md, seção 4.2), com o texto do link, como no protótipo. */
const ROW_BUTTON = `inline-flex h-7 cursor-pointer items-center rounded-sm px-2 text-label text-link hover:bg-surface-subtle ${FOCUS_RING}`;

/** O que a seção mostra além da tabela: nada, o formulário de registrar ou o de encerrar uma participação. */
type Mode = { readonly kind: 'table' } | { readonly kind: 'register' } | { readonly kind: 'end'; stake: EquityStake };

const TABLE: Mode = { kind: 'table' };

/**
 * A seção "Participações societárias" do detalhe da empresa: a tabela do sócio, da fração e do período,
 * de 10 em 10, com a página no endereço, o "Encerrar" de cada participação sem fim e o "Registrar
 * participação". Os formulários abrem dentro da seção, como no protótipo, e fecham no "Cancelar" ou
 * quando o envio deles é aceito; outra ação da página, que mostra a tela de novo, não os fecha.
 */
export function EquityStakes({
  company,
  stakes,
  holders,
}: Readonly<{
  company: { readonly id: string };
  stakes: ListPage<EquityStake>;
  /** A primeira página das entidades ativas, sem busca, para a escolha do sócio. */
  holders: ListPage<EntityOption>;
}>) {
  const [mode, setMode] = useState<Mode>(TABLE);
  const close = () => {
    setMode(TABLE);
  };
  /** O "Encerrar" da participação sem fim, na tabela e na lista. */
  const endButton = (stake: EquityStake) =>
    stake.endDate === null && (
      <button
        type="button"
        aria-label={`Encerrar a participação de ${stake.holder.name}`}
        onClick={() => {
          setMode({ kind: 'end', stake });
        }}
        className={ROW_BUTTON}
      >
        Encerrar
      </button>
    );

  return (
    <section aria-labelledby="equity-stakes-title" className="flex flex-col gap-3 border-t border-hairline pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="equity-stakes-title" className="text-heading-sm text-ink">
          Participações societárias
        </h3>
        <button
          type="button"
          onClick={() => {
            setMode({ kind: 'register' });
          }}
          className={SECONDARY_BUTTON}
        >
          Registrar participação
        </button>
      </div>
      {mode.kind === 'register' && <EquityStakeForm companyId={company.id} holders={holders} onClose={close} />}
      {stakes.total === 0 ? (
        <p className="text-body-sm text-mute">Nenhuma participação registrada.</p>
      ) : (
        // A tabela só aparece quando cabe: abaixo de `container-table`, como no celular, as participações vêm
        // numa lista, com o sócio e a fração na primeira linha e o período na segunda (design-system.md,
        // seção 4.4).
        <div className="@container">
          <ul aria-labelledby="equity-stakes-title" className="flex flex-col @table:hidden">
            {stakes.items.map((stake) => (
              <li key={stake.id} className="flex flex-col gap-1 border-t border-hairline py-2">
                <span className="flex items-start justify-between gap-3 text-ink">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="wrap-anywhere">{stake.holder.name}</span>
                    {!stake.holder.active && <EntityBadge entity={stake.holder} />}
                  </span>
                  <span className="flex-none">{formatFraction(stake.fraction)}</span>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-mute">{periodText(stake)}</span>
                  {endButton(stake)}
                </span>
              </li>
            ))}
          </ul>
          <table aria-labelledby="equity-stakes-title" className="hidden w-full border-collapse @table:table">
            <thead>
              <tr>
                <th scope="col" className={`${HEAD} text-left`}>
                  Sócio
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  Fração
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  Período
                </th>
                <th scope="col" className="p-0">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {stakes.items.map((stake) => (
                <tr key={stake.id}>
                  <td className={`${CELL} text-ink`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="wrap-anywhere">{stake.holder.name}</span>
                      {!stake.holder.active && <EntityBadge entity={stake.holder} />}
                    </span>
                  </td>
                  <td className={`${CELL} text-right text-ink`}>{formatFraction(stake.fraction)}</td>
                  <td className={`${CELL} pl-3 text-right whitespace-nowrap`}>{periodText(stake)}</td>
                  <td className={`${CELL} w-px pl-3 text-right`}>{endButton(stake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode.kind === 'end' && (
        <EndEquityStakeForm key={mode.stake.id} companyId={company.id} stake={mode.stake} onClose={close} />
      )}
      {stakes.total > stakes.pageSize && <UrlPagination page={stakes} />}
    </section>
  );
}
