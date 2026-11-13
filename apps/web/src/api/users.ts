import 'server-only';

import { type CommandResult, commandResult } from './api-error';
import { api } from './client';
import type { components } from './schema';

type ChangePassword = components['schemas']['ChangePassword'];

/** Troca a senha do usuário do cookie; a api encerra as outras sessões dele. */
export function changePassword(body: ChangePassword): Promise<CommandResult> {
  return commandResult((signal) => api.PUT('/v1/users/me/password', { body, signal }));
}
