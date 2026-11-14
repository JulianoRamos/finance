import { ApiError } from './api-error.js';

/** A recusa de toda rota protegida sem uma sessão válida (o guard da sessão). */
export const UNAUTHENTICATED_RESPONSE = {
  type: ApiError,
  description:
    '`UNAUTHENTICATED`: sem sessão, ou com a sessão encerrada, vencida pelo prazo máximo ou por inatividade.',
};
