import { randomUUID } from 'node:crypto';

import type { INestApplicationContext } from '@nestjs/common';

import { runInRequestContext } from '../common/index.js';
import { IdentityError, IdentityService } from '../modules/identity/index.js';

/** Onde o comando escreve: a saída, para o operador, e os erros. */
export interface CommandOutput {
  out(line: string): void;
  err(line: string): void;
}

const USAGE = [
  'Uso:',
  '  create-user <nome> <email>   cria o usuário que gere os acessos e imprime o link para definir a senha',
  '  recover-access <email>       imprime um link para o usuário definir uma senha nova',
].join('\n');

async function createUser(app: INestApplicationContext, name: string, email: string, output: CommandOutput) {
  const link = await app.get(IdentityService).createUser({ name, email, managesAccess: true });
  output.out('Usuário criado. Entregue ao usuário o link abaixo, para definir a senha. Ele vale 1 hora e uma vez só:');
  output.out(link.url);
}

async function recoverAccess(app: INestApplicationContext, email: string, output: CommandOutput) {
  const link = await app.get(IdentityService).createRecoveryLink(email);
  output.out(
    'Link de recuperação criado. Entregue ao usuário o link abaixo, para definir a senha nova. Ele vale 1 hora e uma vez só, e usá-lo encerra as sessões abertas:',
  );
  output.out(link.url);
}

/** O comando dos argumentos, pronto para rodar, ou nulo quando eles não são os do uso. */
function commandOf(app: INestApplicationContext, args: readonly string[], output: CommandOutput) {
  const [command, ...rest] = args;
  if (command === 'create-user' && rest.length === 2) {
    const [name, email] = rest as [string, string];
    return () => createUser(app, name, email, output);
  }
  if (command === 'recover-access' && rest.length === 1) {
    const [email] = rest as [string];
    return () => recoverAccess(app, email, output);
  }
  return null;
}

/**
 * Roda um comando da api (LLD, seção 6.1) com os argumentos dados, na app já montada, e devolve o
 * código de saída: 0 no sucesso, 1 no pedido recusado, 2 no uso errado. Cada execução roda num
 * contexto da requisição próprio, sem usuário (LLD, seção 3).
 */
export async function runCommand(
  app: INestApplicationContext,
  args: readonly string[],
  output: CommandOutput,
): Promise<number> {
  const command = commandOf(app, args, output);
  if (!command) {
    output.err(USAGE);
    return 2;
  }
  try {
    await runInRequestContext(
      { requestId: randomUUID(), userId: null, entityLevels: null, transaction: null },
      command,
    );
    return 0;
  } catch (error) {
    if (!(error instanceof IdentityError)) throw error;
    output.err(error.message);
    return 1;
  }
}
