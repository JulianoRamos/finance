/**
 * Um pedido recusado pela Identidade, com a mensagem para quem o fez. O código, quando há, é o do
 * contrato, com que a rota responde 422 (LLD, seção 5); o comando no servidor mostra só a mensagem.
 */
export class IdentityError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
