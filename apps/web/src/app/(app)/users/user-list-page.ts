import type { EntityPermission, User } from '@/api/users';

/** Um usuário como a lista o mostra, já formatado. */
export interface UserListItem {
  readonly id: string;
  readonly name: string;
  /** A segunda linha: o e-mail e, com a senha definida, o resumo do acesso. */
  readonly detail: string;
  /** O selo: "Senha não definida" até ele usar o link, ou "Desativado"; nulo sem selo. */
  readonly badge: string | null;
  readonly active: boolean;
}

/**
 * O usuário como a lista o mostra (protótipo Usuarios): o e-mail com o resumo do acesso ("gere acessos"
 * ou "por entidade"), e o selo "Senha não definida" no lugar do resumo até ele usar o link.
 */
export function userListItem(user: User): UserListItem {
  const summary = user.managesAccess ? 'gere acessos' : 'por entidade';
  let badge: string | null = null;
  if (!user.active) badge = 'Desativado';
  else if (!user.passwordSet) badge = 'Senha não definida';
  return {
    id: user.id,
    name: user.name,
    active: user.active,
    badge,
    detail: user.passwordSet ? `${user.email} · ${summary}` : user.email,
  };
}

/** Uma linha da tabela de permissões: a entidade e o nível do usuário nela, como a api a devolve. */
export type PermissionRow = EntityPermission;
