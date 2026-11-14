import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { apiError, CONFIG, type Config, currentRequestContext, TransactionService } from '../../common/index.js';
import { normalizeEmail } from './email.js';
import type {
  CreatedUser,
  GeneratedRecoveryLink,
  PermissionChange,
  User,
  UserAccess,
  UserEdit,
} from './identity.dto.js';
import { IdentityError } from './identity-error.js';
import { PermissionsService } from './permissions.service.js';
import { RecoveryLinksService } from './recovery-links.service.js';
import { SessionsService } from './sessions.service.js';
import { type NewUser, toUser, UsersService, versionConflict } from './users.service.js';

/** A recusa do pedido de quem gere acessos sobre o próprio acesso (regra 6.1). */
function selfAccessChange(message: string) {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, 'SELF_ACCESS_CHANGE', message);
}

/**
 * O serviço público da Identidade, que os comandos, as rotas de usuários e os outros módulos chamam.
 * Ele junta, na mesma transação, o usuário, as permissões, os links e as sessões.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly users: UsersService,
    private readonly permissions: PermissionsService,
    private readonly recoveryLinks: RecoveryLinksService,
    private readonly sessions: SessionsService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Cria o usuário, sem senha, e um link de recuperação para ele defini-la. */
  createUser(user: NewUser): Promise<GeneratedRecoveryLink> {
    return this.transactions.run(async () => this.newLink((await this.users.create(user)).id));
  }

  /** Cria um link de recuperação para o usuário do e-mail. */
  createRecoveryLink(email: string): Promise<GeneratedRecoveryLink> {
    return this.transactions.run(async () => {
      const user = await this.users.findByEmail(email);
      if (!user) throw new IdentityError(`Não há usuário com o e-mail ${normalizeEmail(email)}.`);
      // O link de um usuário desativado nunca valeria (regra 6.1).
      if (!user.active) throw inactiveUser(user.email);
      return this.newLink(user.id);
    });
  }

  /** Cadastra o usuário pela rota, com as permissões dele, e gera o link para ele definir a senha. */
  register(input: NewUser & { readonly permissions?: readonly PermissionChange[] }): Promise<CreatedUser> {
    return this.transactions.run(async () => {
      const created = await this.users.create(input);
      await this.permissions.apply(created.id, input.permissions ?? []);
      return { user: toUser(created), recoveryLink: await this.newLink(created.id) };
    });
  }

  /** Gera um link de recuperação para o usuário do id, que precisa estar ativo. */
  generateRecoveryLink(userId: string): Promise<GeneratedRecoveryLink> {
    return this.transactions.run(async () => {
      const user = await this.users.read(userId);
      if (!user.active) throw inactiveUser(user.email);
      return this.newLink(user.id);
    });
  }

  /** Edita o nome e o e-mail do usuário, com a versão lida. A troca do e-mail encerra as sessões dele. */
  edit(userId: string, input: UserEdit): Promise<User> {
    return this.transactions.run(async () => {
      const before = await this.users.read(userId);
      if (before.version !== input.version) throw versionConflict();
      const after = await this.users.update(before, {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
      });
      if (after.email !== before.email) await this.sessions.endAll(userId);
      return toUser(after);
    });
  }

  /**
   * Desativa ou reativa o usuário, com a versão lida. Desativar encerra as sessões dele, e as permissões
   * ficam (regra 6.1). Pedir o estado que ele já tem não muda nada. Ninguém desativa a si mesmo.
   */
  setActive(userId: string, active: boolean, version: number): Promise<User> {
    if (!active && userId === currentUserId()) {
      throw selfAccessChange('Você não pode desativar o seu próprio usuário.');
    }
    return this.transactions.run(async () => {
      const before = await this.users.read(userId);
      if (before.active === active) return toUser(before);
      if (before.version !== version) throw versionConflict();
      const after = await this.users.update(before, { active });
      if (!active) await this.sessions.endAll(userId);
      return toUser(after);
    });
  }

  /**
   * Grava o gerir acessos e as permissões que mudam, com a versão lida, que sobe mesmo quando só as
   * permissões mudam. Ninguém tira de si mesmo o gerir acessos.
   */
  setAccess(userId: string, input: UserAccess): Promise<User> {
    if (!input.managesAccess && userId === currentUserId()) {
      throw selfAccessChange('Você não pode tirar de si mesmo o gerir acessos.');
    }
    return this.transactions.run(async () => {
      const before = await this.users.read(userId);
      if (before.version !== input.version) throw versionConflict();
      const after = await this.users.update(before, { managesAccess: input.managesAccess });
      await this.permissions.apply(userId, input.permissions);
      return toUser(after);
    });
  }

  /** Cria um link de recuperação do usuário, com o endereço público da web. */
  private async newLink(userId: string): Promise<GeneratedRecoveryLink> {
    const { token, expiresAt } = await this.recoveryLinks.create(userId);
    return { url: `${this.config.publicUrl}/set-password/${token}`, expiresAt };
  }
}

/** A recusa do link de um usuário desativado, que nunca valeria (regra 6.1). */
function inactiveUser(email: string) {
  return new IdentityError(`O usuário ${email} está desativado: reative-o antes.`, 'INACTIVE_USER');
}

/** O usuário da sessão que fez o pedido, ou nulo num comando no servidor. */
function currentUserId(): string | null {
  return currentRequestContext()?.userId ?? null;
}
