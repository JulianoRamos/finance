import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

import { PageInfo } from '../../common/index.js';

/** A senha: pelo menos 12 caracteres, sem outra regra de composição (regra 6.1). */
const PASSWORD_MIN_LENGTH = 12;
/** O limite de cima da senha, para o hash não receber um texto sem fim. */
const PASSWORD_MAX_LENGTH = 256;
/** O limite de cima do e-mail (RFC 5321). */
const EMAIL_MAX_LENGTH = 320;

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
