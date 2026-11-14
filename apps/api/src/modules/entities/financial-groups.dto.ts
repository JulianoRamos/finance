import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

import { EntityType, PageInfo, PageQuery, SearchQuery } from '../../common/index.js';
import { IsName, NAME_MAX_LENGTH, VersionRead } from './fields.js';

const NAME_INPUT_DESCRIPTION = `O nome do grupo, como o usuário quer vê-lo, com até ${String(NAME_MAX_LENGTH)} caracteres. A api tira os espaços das pontas. Não é único.`;
const MEMBER_IDS_DESCRIPTION =
  'Os ids das entidades do grupo, a lista inteira, sem repetir. Pode ser vazia. Uma entidade desativada não entra, e a que já estava no grupo pode continuar (regra 6.2). Na Visão Familiar, só pessoas físicas.';

/** O nome do grupo na entrada, com a descrição dada. */
function GroupName(description: string): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ description, minLength: 1, maxLength: NAME_MAX_LENGTH, example: 'Tudo da Ana' }),
    IsName({ message: `Informe o nome, com até ${String(NAME_MAX_LENGTH)} caracteres.` }),
  );
}

/** A lista inteira dos membros na entrada. */
function MemberIds(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      type: String,
      format: 'uuid',
      isArray: true,
      uniqueItems: true,
      description: MEMBER_IDS_DESCRIPTION,
    }),
    IsArray({ message: 'Informe os membros numa lista.' }),
    IsUUID('all', { each: true, message: 'O id de um membro não é válido.' }),
    // O mesmo UUID em maiúsculas é o mesmo id.
    ArrayUnique((id: unknown) => (typeof id === 'string' ? id.toLowerCase() : id), {
      message: 'Uma entidade aparece mais de uma vez.',
    }),
  );
}

export class FinancialGroupMember {
  @ApiProperty({ format: 'uuid', description: 'O id da entidade.' })
  id!: string;

  @ApiProperty({ enum: EntityType, description: 'Pessoa física (`individual`) ou jurídica (`company`).' })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Ana Lima' })
  name!: string;

  @ApiProperty({
    description:
      'Falso na entidade desativada depois de entrar no grupo: ela continua nele até sair, e não entra de novo (regra 6.2).',
  })
  active!: boolean;
}

export class FinancialGroup {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'O nome do grupo.', example: 'Tudo da Ana' })
  name!: string;

  @ApiProperty({
    description:
      'Verdadeiro só na Visão Familiar, que já vem criada, só aceita pessoas físicas e não é renomeada nem excluída (regra 6.2).',
  })
  isFamilyView!: boolean;

  @ApiProperty({
    type: FinancialGroupMember,
    isArray: true,
    description: 'As entidades do grupo, pelo nome, em ordem alfabética.',
  })
  members!: FinancialGroupMember[];

  @ApiProperty({ type: String, format: 'date-time', description: 'Quando o grupo foi criado.' })
  createdAt!: Date;

  @ApiProperty({ type: 'integer', description: 'A versão, que a edição manda de volta (regra 6.20).', example: 1 })
  version!: number;
}

export class NewFinancialGroup {
  @GroupName(NAME_INPUT_DESCRIPTION)
  name!: string;

  @MemberIds()
  memberIds!: string[];
}

export class FinancialGroupEdit {
  @VersionRead()
  version!: number;

  @GroupName(
    `${NAME_INPUT_DESCRIPTION} Na Visão Familiar, tem de ser o atual: a api recusa a mudança com 422 \`FAMILY_VIEW_PROTECTED\` (regra 6.2).`,
  )
  name!: string;

  @MemberIds()
  memberIds!: string[];
}

export class FinancialGroupListQuery extends PageQuery {
  @SearchQuery(
    'A busca: o texto procurado no nome, sem diferença de acento nem de maiúsculas, em qualquer posição. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}

export class FinancialGroupPage extends PageInfo {
  @ApiProperty({ type: FinancialGroup, isArray: true, description: 'Os grupos da página, na ordem da lista.' })
  items!: FinancialGroup[];
}

export class FinancialGroupId {
  @ApiProperty({ format: 'uuid', description: 'O id do grupo.' })
  @IsUUID('all', { message: 'O id do grupo não é válido.' })
  id!: string;
}
