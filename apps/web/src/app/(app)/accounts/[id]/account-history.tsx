'use client';

import { HistoryPanel } from '../../../_shell/history-panel';
import { accountHistoryAction } from '../actions';

/** O "Histórico" do detalhe da conta, com as alterações dela ditas como a tela as mostra. */
export function AccountHistory({ accountId, accountName }: Readonly<{ accountId: string; accountName: string }>) {
  return (
    <HistoryPanel
      description={`${accountName} · conta`}
      loadPage={(page) => accountHistoryAction({ id: accountId, page })}
    />
  );
}
