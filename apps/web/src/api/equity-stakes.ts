import 'server-only';

import { type DataResult, dataResult, type ReadResult, readResult } from './api-error';
import { api } from './client';
import type { components } from './schema';

export type EquityStake = components['schemas']['EquityStake'];
export type EquityStakePage = components['schemas']['EquityStakePage'];
type NewEquityStake = components['schemas']['NewEquityStake'];
type EquityStakeEnd = components['schemas']['EquityStakeEnd'];

/** A página das participações na empresa, encerradas ou não, as sem fim primeiro. */
export function listEquityStakes(companyId: string, page: number): Promise<ReadResult<EquityStakePage>> {
  return readResult((init) =>
    api.GET('/v1/entities/{id}/equity-stakes', { params: { path: { id: companyId }, query: { page } }, ...init }),
  );
}

/** O resultado de um comando sobre uma participação: ela, como ficou, ou o erro do contrato. */
type EquityStakeResult = DataResult<EquityStake>;

/** Registra a participação de um sócio na empresa. */
export function createEquityStake(companyId: string, body: NewEquityStake): Promise<EquityStakeResult> {
  return dataResult((signal) =>
    api.POST('/v1/entities/{id}/equity-stakes', { params: { path: { id: companyId } }, body, signal }),
  );
}

/** Encerra a participação sem fim com o último dia, com a versão lida. */
export function endEquityStake(companyId: string, stakeId: string, body: EquityStakeEnd): Promise<EquityStakeResult> {
  return dataResult((signal) =>
    api.PUT('/v1/entities/{id}/equity-stakes/{stakeId}/end', {
      params: { path: { id: companyId, stakeId } },
      body,
      signal,
    }),
  );
}
