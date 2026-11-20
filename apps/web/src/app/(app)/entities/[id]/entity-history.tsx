'use client';

import type { EntityType } from '@/api/entities';

import { HistoryPanel } from '../../../_shell/history-panel';
import { entityHistoryAction } from '../actions';

/** O "Histórico" do detalhe da entidade, com as alterações dela ditas como a tela as mostra. */
export function EntityHistory({
  entityId,
  entityName,
  entityType,
}: Readonly<{ entityId: string; entityName: string; entityType: EntityType }>) {
  return (
    <HistoryPanel
      description={`${entityName} · entidade`}
      loadPage={(page) => entityHistoryAction({ id: entityId, type: entityType, page })}
    />
  );
}
