import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, ValidateBy, type ValidationOptions } from 'class-validator';

import { searchPattern, type Sql, sql } from './page.js';

// O que os registros com nome e versão têm em comum (entidades, grupos financeiros e usuários): o nome,
// a versão lida, a ordem pelo nome e a busca nele.

/** O limite de cima do nome de uma entidade, de um grupo ou de um usuário, sem os espaços das pontas. */
export const NAME_MAX_LENGTH = 120;

/** A ordem dos nomes em português, que põe "Ágata" junto de "Ana", e não depois de "Zélia". */
export const byName = new Intl.Collator('pt-BR');

/** A mesma ordem no banco, a pt-BR do ICU, que as listas usam depois do nome no `ORDER BY`. */
export const NAME_COLLATION = sql`COLLATE "pt-BR-x-icu"`;

/**
 * A condição da busca no nome: o texto em qualquer posição, sem acento nem diferença de maiúsculas.
 * Verdadeira quando a busca, aparada, é vazia.
 */
export function nameMatches(q: string | undefined): Sql {
  const pattern = searchPattern(q);
  return sql`(${pattern}::text IS NULL OR unaccent(lower(name)) LIKE unaccent(lower(${pattern}::text)) ESCAPE '\\')`;
}

/** O nome tem de 1 a 120 caracteres, sem contar os espaços das pontas. */
export function IsName(options: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isName',
      validator: {
        validate: (value) =>
          typeof value === 'string' && value.trim().length > 0 && value.trim().length <= NAME_MAX_LENGTH,
      },
    },
    options,
  );
}

/** A versão lida, que a edição manda de volta (regra 6.20). */
export function VersionRead(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ type: 'integer', minimum: 1, description: 'A versão lida (regra 6.20).' }),
    IsInt({ message: 'Informe a versão lida.' }),
    Min(1, { message: 'Informe a versão lida.' }),
  );
}
