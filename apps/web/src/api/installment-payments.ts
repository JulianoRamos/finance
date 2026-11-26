import 'server-only';

import {
  type CommandResult,
  commandResult,
  type DataResult,
  dataResult,
  MAX_PAGE_SIZE,
  type ReadResult,
  readAllPages,
  readResult,
} from './api-error';
import { api } from './client';
import type { Entry } from './entries';
import type { components } from './schema';

export type InstallmentPayment = components['schemas']['InstallmentPayment'];
type NewPaidEntry = components['schemas']['NewPaidEntry'];
type NewInstallmentPayment = components['schemas']['NewInstallmentPayment'];

/** Registra um lançamento já pago: o lançamento e o pagamento da primeira parcela, a única no à vista. */
export function createPaidEntry(body: NewPaidEntry): Promise<DataResult<Entry>> {
  return dataResult((signal) => api.POST('/v1/paid-entries', { body, signal }));
}

/** Paga uma parcela em aberto, na conta e na data dadas. */
export function payInstallment(body: NewInstallmentPayment): Promise<DataResult<InstallmentPayment>> {
  return dataResult((signal) => api.POST('/v1/installment-payments', { body, signal }));
}

/** Desfaz o pagamento de uma parcela. */
export function undoInstallmentPayment(id: string): Promise<CommandResult> {
  return commandResult((signal) => api.DELETE('/v1/installment-payments/{id}', { params: { path: { id } }, signal }));
}

/** Todos os pagamentos das parcelas do lançamento, pelo número da parcela. */
export function listInstallmentPayments(entryId: string): Promise<ReadResult<InstallmentPayment[]>> {
  return readAllPages(
    (page) =>
      readResult((init) =>
        api.GET('/v1/installment-payments', {
          params: { query: { entryId, page, pageSize: MAX_PAGE_SIZE } },
          ...init,
        }),
      ),
    (payment) => payment,
  );
}
