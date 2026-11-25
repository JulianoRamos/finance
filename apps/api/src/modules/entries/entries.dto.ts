import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

import {
  CategoryNature,
  IsName,
  NAME_MAX_LENGTH,
  PageInfo,
  PageQuery,
  SearchQuery,
  VersionRead,
} from '../../common/index.js';

const NAME_EXAMPLE = 'Energia';
const PARENT_DESCRIPTION =
  'A categoria pai, de primeiro nível e da mesma natureza, ou nulo na de primeiro nível. A árvore tem dois níveis (LLD, seção 4.6).';
const NATURE_DESCRIPTION =
  'Receita (`revenue`) ou despesa (`expense`). Não muda depois de criada; a subcategoria tem a do pai (LLD, seção 4.6).';
const NATURE_MESSAGE = 'Escolha a natureza: receita ou despesa.';
const PARENT_MESSAGE = 'A categoria pai não é válida.';

function NameInput(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      description: 'O nome, como o usuário quer vê-lo. A api tira os espaços das pontas. Não é único.',
      minLength: 1,
      maxLength: NAME_MAX_LENGTH,
      example: NAME_EXAMPLE,
    }),
    IsName({ message: `Informe o nome, com até ${String(NAME_MAX_LENGTH)} caracteres.` }),
  );
}

export class Category {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: PARENT_DESCRIPTION })
  parentId!: string | null;

  @ApiProperty({ description: 'O nome da categoria.', example: NAME_EXAMPLE })
  name!: string;

  @ApiProperty({ enum: CategoryNature, description: NATURE_DESCRIPTION })
  nature!: CategoryNature;

  @ApiProperty({
    description:
      'Falso na categoria desativada, que some das escolhas dos lançamentos novos e continua nos que já tem (regra 6.20).',
  })
  active!: boolean;

  @ApiProperty({
    type: 'integer',
    description: 'A versão, que a edição e a desativação mandam de volta (regra 6.20).',
    example: 1,
  })
  version!: number;
}

export class CategoryTreeChild extends Category {
  @ApiProperty({ description: 'Verdadeiro quando o nome bate com a busca (`q`). Sem busca, sempre verdadeiro.' })
  matched!: boolean;
}

export class CategoryTreeItem extends Category {
  @ApiProperty({
    description:
      'Verdadeiro quando o nome bate com a busca (`q`). Falso na categoria que só aparece porque uma subcategoria dela bate, para a tela mostrar o caminho. Sem busca, sempre verdadeiro.',
  })
  matched!: boolean;

  @ApiProperty({
    type: CategoryTreeChild,
    isArray: true,
    description:
      'As subcategorias, pelo nome, em ordem alfabética: todas sem busca, e só as que batem com ela, com a busca.',
  })
  children!: CategoryTreeChild[];
}

export class CategoryTreePage extends PageInfo {
  @ApiProperty({
    type: CategoryTreeItem,
    isArray: true,
    description:
      'As categorias de primeiro nível da página, pelo nome, em ordem alfabética, cada uma com as subcategorias.',
  })
  items!: CategoryTreeItem[];
}

export class CategoryListQuery extends PageQuery {
  @ApiProperty({ enum: CategoryNature, description: 'A natureza da árvore: a de receita ou a de despesa.' })
  @IsEnum(CategoryNature, { message: NATURE_MESSAGE })
  nature!: CategoryNature;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      '`true` traz só as categorias ativas, as das escolhas dos lançamentos; `false`, só as desativadas. Sem o parâmetro, traz todas.',
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'Use true ou false.' })
  active?: 'true' | 'false';

  @SearchQuery(
    'A busca: o texto procurado no nome da categoria, sem diferença de acento nem de maiúsculas, em qualquer posição. Traz as categorias de primeiro nível que batem e as que têm uma subcategoria que bate, com só as subcategorias que batem. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}

export class NewCategory {
  @NameInput()
  name!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'A categoria pai, de primeiro nível. Sem ela, a categoria nasce no primeiro nível.',
  })
  @IsOptional()
  @IsUUID('all', { message: PARENT_MESSAGE })
  // O `IsOptional` também deixa passar o nulo, que vale como sem o pai.
  parentId?: string | null;

  @ApiPropertyOptional({
    enum: CategoryNature,
    description:
      'A natureza, obrigatória na categoria de primeiro nível. Com o pai, pode faltar, e a subcategoria tem a dele; quando vem, tem de ser a do pai.',
  })
  // Sem o pai (ausente ou nulo), a natureza é obrigatória; com ele, só é conferida quando vem.
  @ValidateIf(
    (input: NewCategory) => input.parentId === undefined || input.parentId === null || input.nature !== undefined,
  )
  @IsEnum(CategoryNature, { message: NATURE_MESSAGE })
  nature?: CategoryNature;
}

export class CategoryEdit {
  @VersionRead()
  version!: number;

  @NameInput()
  name!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'O pai depois da edição: o atual, outro de primeiro nível e da mesma natureza, ou nulo, que leva a categoria para o primeiro nível.',
  })
  @ValidateIf((input: CategoryEdit) => input.parentId !== null)
  @IsUUID('all', { message: PARENT_MESSAGE })
  parentId!: string | null;

  @ApiProperty({
    enum: CategoryNature,
    description:
      'A natureza, que tem de ser a atual: a api recusa a troca com 422 `CATEGORY_NATURE_IMMUTABLE` (LLD, seção 4.6).',
  })
  @IsEnum(CategoryNature, { message: NATURE_MESSAGE })
  nature!: CategoryNature;
}

export class CategoryActivation {
  @VersionRead()
  version!: number;

  @ApiProperty({
    description:
      'Falso desativa a categoria, e a de primeiro nível leva as subcategorias junto; verdadeiro a reativa, sozinha.',
  })
  @IsBoolean({ message: 'Informe se a categoria fica ativa.' })
  active!: boolean;
}

export class CategoryId {
  @ApiProperty({ format: 'uuid', description: 'O id da categoria.' })
  @IsUUID('all', { message: 'O id da categoria não é válido.' })
  id!: string;
}
