import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, ValidateBy, type ValidationOptions } from 'class-validator';

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
