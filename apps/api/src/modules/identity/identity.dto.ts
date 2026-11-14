import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  isUUID,
  MaxLength,
  MinLength,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

import {
  EntityType,
  IsName,
  NAME_MAX_LENGTH,
  PageInfo,
  PageQuery,
  SearchQuery,
  VersionRead,
} from '../../common/index.js';
import { isEmail, normalizeEmail } from './email.js';

/** A senha: pelo menos 12 caracteres, sem outra regra de composição (regra 6.1). */
const PASSWORD_MIN_LENGTH = 12;
/** O limite de cima da senha, para o hash não receber um texto sem fim. */
const PASSWORD_MAX_LENGTH = 256;
/** O limite de cima do e-mail (RFC 5321). */
const EMAIL_MAX_LENGTH = 320;

/** O nível numa entidade, como as rotas o escrevem: `none` é a falta de permissão (regra 6.1). */
export const ACCESS_LEVELS = ['none', 'view', 'operate'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** O campo é igual a outro campo do mesmo objeto. */
function EqualsField(field: string, options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'equalsField',
      constraints: [field],
      validator: {
        validate: (value, args) => value === (args?.object as Record<string, unknown> | undefined)?.[field],
      },
    },
    options,
  );
}

export class Login {
  @ApiProperty({
    description: 'O e-mail do usuário. Comparado sem distinguir maiúsculas.',
    example: 'ana@exemplo.com',
    maxLength: EMAIL_MAX_LENGTH,
  })
  @IsString({ message: 'Informe o e-mail.' })
  @MaxLength(EMAIL_MAX_LENGTH, { message: `Use no máximo ${String(EMAIL_MAX_LENGTH)} caracteres.` })
  email!: string;

  @ApiProperty({ description: 'A senha.', maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'Informe a senha.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Use no máximo ${String(PASSWORD_MAX_LENGTH)} caracteres.` })
  password!: string;
}

export class SessionToken {
  @ApiProperty({
    description: 'O token opaco da sessão, que a web guarda no cookie httpOnly. Não é devolvido de novo.',
  })
  token!: string;

  @ApiProperty({ description: 'O prazo máximo da sessão (o login mais SESSION_MAX_DAYS).' })
  expiresAt!: Date;
}

export class SessionUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ description: 'Se gere usuários e acessos (regra 6.1).' })
  managesAccess!: boolean;
}

export class CurrentSession {
  @ApiProperty()
  user!: SessionUser;

  @ApiProperty({ description: 'O prazo máximo da sessão.' })
  expiresAt!: Date;
}

export class ChangePassword {
  @ApiProperty({ description: 'A senha atual.', maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'Informe a senha atual.' })
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Use no máximo ${String(PASSWORD_MAX_LENGTH)} caracteres.` })
  currentPassword!: string;

  @ApiProperty({ description: 'A senha nova.', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'Informe a senha nova.' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Use pelo menos ${String(PASSWORD_MIN_LENGTH)} caracteres.` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Use no máximo ${String(PASSWORD_MAX_LENGTH)} caracteres.` })
  password!: string;

  @ApiProperty({ description: 'A senha nova, repetida (regra 6.1).' })
  @IsString({ message: 'Repita a senha nova.' })
  @EqualsField('password', { message: 'As duas senhas precisam ser iguais.' })
  passwordConfirmation!: string;
}

export class SessionSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'O navegador, lido do User-Agent do login, como "Chrome" ou "Safari". Nulo quando o User-Agent não veio ou não é de um navegador conhecido.',
    example: 'Chrome',
  })
  browser!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'O sistema ou o aparelho, lido do User-Agent do login, como "macOS", "Windows" ou "iPhone". Nulo quando não é reconhecido.',
    example: 'macOS',
  })
  platform!: string | null;

  @ApiProperty({ description: 'O endereço de origem do login (regra 6.1).', example: '192.0.2.10' })
  origin!: string;

  @ApiProperty({ description: 'O instante do login.' })
  createdAt!: Date;

  @ApiProperty({ description: 'O último uso, gravado no máximo uma vez por minuto.' })
  lastUsedAt!: Date;

  @ApiProperty({ description: 'Se é a sessão do token que fez o pedido.' })
  current!: boolean;
}

export class SessionPage extends PageInfo {
  @ApiProperty({ type: SessionSummary, isArray: true, description: 'As sessões da página, na ordem da lista.' })
  items!: SessionSummary[];
}

export class SessionId {
  @ApiProperty({ format: 'uuid', description: 'O id da sessão, como a lista de sessões o devolve.' })
  @IsUUID('all', { message: 'O id da sessão não é válido.' })
  id!: string;
}

export class RecoveryLink {
  @ApiProperty({ description: 'O e-mail do usuário que vai definir a senha.' })
  email!: string;
}

export class SetPassword {
  @ApiProperty({ description: 'A senha nova.', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString({ message: 'Informe a senha.' })
  @MinLength(PASSWORD_MIN_LENGTH, { message: `Use pelo menos ${String(PASSWORD_MIN_LENGTH)} caracteres.` })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: `Use no máximo ${String(PASSWORD_MAX_LENGTH)} caracteres.` })
  password!: string;

  @ApiProperty({ description: 'A senha nova, repetida (regra 6.1).' })
  @IsString({ message: 'Repita a senha.' })
  @EqualsField('password', { message: 'As duas senhas precisam ser iguais.' })
  passwordConfirmation!: string;
}

/** O nome do usuário na entrada: de 1 a 120 caracteres, sem contar os espaços das pontas. */
function UserName(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: 'O nome, como aparece na interface. A api tira os espaços das pontas.',
      minLength: 1,
      maxLength: NAME_MAX_LENGTH,
      example: 'Bruno Lima',
    }),
    IsName({ message: `Informe o nome, com até ${String(NAME_MAX_LENGTH)} caracteres.` }),
  );
}

/** O e-mail do usuário na entrada, que é o login. */
function UserEmail(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description:
        'O e-mail, que é o login. Comparado e guardado em minúsculas, sem espaços nas pontas. Único entre todos os usuários, ativos ou não.',
      maxLength: EMAIL_MAX_LENGTH,
      example: 'bruno@exemplo.com',
    }),
    ValidateBy(
      {
        name: 'isUserEmail',
        validator: {
          validate: (value) =>
            typeof value === 'string' && value.length <= EMAIL_MAX_LENGTH && isEmail(normalizeEmail(value)),
        },
      },
      { message: 'Informe um e-mail válido.' },
    ),
  );
}

/** Se o valor é uma mudança de permissão: o id de uma entidade e um nível conhecido. */
function isPermissionChange(value: unknown): value is PermissionChange {
  if (typeof value !== 'object' || value === null) return false;
  const { entityId, level } = value as Record<string, unknown>;
  return typeof entityId === 'string' && isUUID(entityId) && ACCESS_LEVELS.includes(level as AccessLevel);
}

/** As permissões são uma lista de mudanças, cada entidade uma vez só. */
function IsPermissionChanges(): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPermissionChanges',
      validator: {
        validate: (value) =>
          Array.isArray(value) &&
          value.every(isPermissionChange) &&
          new Set(value.map((change) => change.entityId)).size === value.length,
      },
    },
    { message: 'Informe as permissões numa lista, cada entidade uma vez só, com sem acesso, ver ou operar.' },
  );
}

export class User {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'O nome, como aparece na interface.', example: 'Bruno Lima' })
  name!: string;

  @ApiProperty({ description: 'O e-mail, que é o login, em minúsculas.', example: 'bruno@exemplo.com' })
  email!: string;

  @ApiProperty({
    description:
      'Se gere usuários e acessos: cadastra usuários, define permissões e gera links de recuperação (regra 6.1).',
  })
  managesAccess!: boolean;

  @ApiProperty({ description: 'Falso no usuário desativado, que não entra (regra 6.1).' })
  active!: boolean;

  @ApiProperty({
    description:
      'Falso até o usuário definir a senha pelo link de recuperação. A tela mostra o selo "Senha não definida".',
  })
  passwordSet!: boolean;

  @ApiProperty({
    type: 'integer',
    description: 'A versão, que a edição, a desativação e a gravação dos acessos mandam de volta (regra 6.20).',
    example: 1,
  })
  version!: number;
}

export class UserPage extends PageInfo {
  @ApiProperty({ type: User, isArray: true, description: 'Os usuários da página, na ordem da lista.' })
  items!: User[];
}

export class UserListQuery extends PageQuery {
  @SearchQuery(
    'A busca: o texto procurado no nome e no e-mail, sem diferença de acento nem de maiúsculas, em qualquer posição. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}

export class UserId {
  @ApiProperty({ format: 'uuid', description: 'O id do usuário.' })
  @IsUUID('all', { message: 'O id do usuário não é válido.' })
  id!: string;
}

export class PermissionChange {
  @ApiProperty({ format: 'uuid', description: 'A entidade.' })
  entityId!: string;

  @ApiProperty({
    enum: ACCESS_LEVELS,
    description: 'O nível na entidade: `view` lê, `operate` lê e altera, e `none` tira a permissão (regra 6.1).',
  })
  level!: AccessLevel;
}

export class NewUser {
  @UserName()
  name!: string;

  @UserEmail()
  email!: string;

  @ApiProperty({ description: 'Se o usuário gere acessos (regra 6.1).' })
  @IsBoolean({ message: 'Informe se o usuário gere acessos.' })
  managesAccess!: boolean;

  @ApiPropertyOptional({
    type: PermissionChange,
    isArray: true,
    description:
      'As permissões por entidade. Opcional: sem a lista, ou com `none`, o usuário fica sem acesso à entidade. Cada entidade aparece uma vez só.',
  })
  @IsOptional()
  @IsPermissionChanges()
  permissions?: PermissionChange[];
}

export class GeneratedRecoveryLink {
  @ApiProperty({
    description:
      'O link inteiro, com o endereço público da web (`PUBLIC_URL`) e o token: `<PUBLIC_URL>/set-password/<token>`. Só existe nesta resposta: o banco guarda o hash do token.',
    example: 'https://finance.exemplo.com/set-password/<token>',
  })
  url!: string;

  @ApiProperty({ description: 'Até quando o link vale: 1 hora depois de gerado.' })
  expiresAt!: Date;
}

export class CreatedUser {
  @ApiProperty()
  user!: User;

  @ApiProperty({ description: 'O link com que o usuário define a senha.' })
  recoveryLink!: GeneratedRecoveryLink;
}

export class UserEdit {
  @VersionRead()
  version!: number;

  @UserName()
  name!: string;

  @UserEmail()
  email!: string;
}

export class UserActivation {
  @VersionRead()
  version!: number;

  @ApiProperty({ description: 'Falso desativa o usuário; verdadeiro o reativa.' })
  @IsBoolean({ message: 'Informe se o usuário fica ativo.' })
  active!: boolean;
}

export class UserAccess {
  @VersionRead()
  version!: number;

  @ApiProperty({
    description: 'Se o usuário gere acessos. O usuário da sessão não o tira de si mesmo (422 `SELF_ACCESS_CHANGE`).',
  })
  @IsBoolean({ message: 'Informe se o usuário gere acessos.' })
  managesAccess!: boolean;

  @ApiProperty({
    type: PermissionChange,
    isArray: true,
    description:
      'As permissões que mudam. Só as entidades da lista mudam, e as outras ficam como estão; a tela manda as que o usuário alterou, em qualquer página da tabela. Cada entidade aparece uma vez só.',
  })
  @IsPermissionChanges()
  permissions!: PermissionChange[];
}

export class EntityPermissionQuery extends PageQuery {
  @SearchQuery(
    'A busca das entidades, a mesma da lista das entidades: o nome sem diferença de acento nem de maiúsculas, em qualquer posição, e, quando tem um algarismo, o CNPJ. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}

export class EntityPermission {
  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty({ enum: EntityType, description: 'Pessoa física (`individual`) ou jurídica (`company`).' })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Clínica Exemplo' })
  name!: string;

  @ApiProperty({ description: 'Falso na entidade desativada, que continua na tabela.' })
  active!: boolean;

  @ApiProperty({ enum: ACCESS_LEVELS, description: 'O nível do usuário na entidade, ou `none` sem permissão.' })
  level!: AccessLevel;
}

export class EntityPermissionPage extends PageInfo {
  @ApiProperty({
    type: EntityPermission,
    isArray: true,
    description: 'As entidades da página, com o nível do usuário em cada uma.',
  })
  items!: EntityPermission[];
}
