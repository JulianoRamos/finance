import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateBy, ValidateIf } from 'class-validator';

import {
  CategoryNature,
  type DecimalRange,
  Decimal,
  EntryPurpose,
  EntryType,
  IsCalendarDate,
  IsCalendarMonth,
  IsDecimalText,
  IsName,
  IsTrimmedLength,
  NAME_MAX_LENGTH,
  PageInfo,
  PageQuery,
  SearchQuery,
  VersionRead,
} from '../../common/index.js';
import { InstallmentStatus } from './installments.js';

const NAME_EXAMPLE = 'Energia';
const PARENT_DESCRIPTION =
  'A categoria pai, de primeiro nível e da mesma natureza, ou nulo na de primeiro nível. A árvore tem dois níveis (LLD, seção 4.6).';
const NATURE_DESCRIPTION =
  'Receita (`revenue`) ou despesa (`expense`). Não muda depois de criada; a subcategoria tem a do pai (LLD, seção 4.6).';
const NATURE_MESSAGE = 'Escolha a natureza: receita ou despesa.';
const PARENT_MESSAGE = 'A categoria pai não é válida.';
const MONTH_TOTAL_EXAMPLE = '2180.40';
const MONTH_EXAMPLE = '2026-11';
const MONTH_MESSAGE = 'Informe o mês no formato AAAA-MM.';

const ENTRY_TYPE_DESCRIPTION = 'Receita (`revenue`) ou despesa (`expense`) de uma pessoa física (LLD, seção 4.6).';
const PURPOSE_DESCRIPTION =
  'Para que serve a despesa: pessoal (`personal`), de um dos membros, ou familiar (`household`), da casa (GLOSSARY.md, Finalidade). Nula na receita.';
const STATUS_DESCRIPTION =
  'A situação, calculada (regra 6.6): vencida (`overdue`) quando o vencimento é anterior a hoje, no fuso da api, e prevista (`expected`) nos outros casos. A liquidada e a cancelada entram com o pagamento e o cancelamento.';
const OCCURRED_ON_DESCRIPTION = 'O dia do fato, `AAAA-MM-DD`, como a data da compra ou da venda.';
const DESCRIPTION_EXAMPLE = 'Sofá da sala';
const ENTITY_NAME_EXAMPLE = 'Ana Lima';
const CATEGORY_NAME_EXAMPLE = 'Móveis';

/** O limite de cima da descrição do lançamento, sem os espaços das pontas. */
export const ENTRY_DESCRIPTION_MAX_LENGTH = 200;
/** O maior número de parcelas de um lançamento (LLD, seção 4.6). */
const MAX_INSTALLMENTS = 120;
const INSTALLMENT_COUNT_MESSAGE = `Informe o número de parcelas, de 1 a ${String(MAX_INSTALLMENTS)}.`;
/** O total do lançamento: maior que zero, com até 2 casas, no tamanho da coluna (LLD, seção 4.1). */
const TOTAL_AMOUNT_RANGE: DecimalRange = { above: '0', atMost: '9999999999999.99', scale: 2 };

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

  @ApiProperty({
    description:
      'A soma das parcelas que vencem no mês pedido, sem as canceladas, dos lançamentos desta categoria nas pessoas físicas em que o usuário tem `view` ou `operate`, em string decimal com 2 casas (LLD, seção 4.6). Zero quando não há.',
    example: MONTH_TOTAL_EXAMPLE,
  })
  monthTotal!: string;
}

export class CategoryTreeItem extends Category {
  @ApiProperty({
    description:
      'Verdadeiro quando o nome bate com a busca (`q`). Falso na categoria que só aparece porque uma subcategoria dela bate, para a tela mostrar o caminho. Sem busca, sempre verdadeiro.',
  })
  matched!: boolean;

  @ApiProperty({
    description:
      'A soma das parcelas que vencem no mês pedido, sem as canceladas, dos lançamentos desta categoria e das subcategorias dela, todas, também as que a busca e o filtro não trazem, nas pessoas físicas em que o usuário tem `view` ou `operate`, em string decimal com 2 casas (LLD, seção 4.6). Zero quando não há.',
    example: MONTH_TOTAL_EXAMPLE,
  })
  monthTotal!: string;

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

  @ApiPropertyOptional({
    description: 'O mês do total de cada categoria, `AAAA-MM`. Sem ele, o de hoje, no fuso da api.',
    example: MONTH_EXAMPLE,
  })
  @IsOptional()
  @IsCalendarMonth({ message: MONTH_MESSAGE })
  month?: string;
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

/**
 * A finalidade segue o tipo: a despesa tem uma das finalidades, e a receita não tem nenhuma (GLOSSARY.md,
 * Finalidade).
 */
function IsPurposeOfType(): PropertyDecorator {
  return ValidateBy({
    name: 'isPurposeOfType',
    validator: {
      validate: (value, args) => {
        const type = (args?.object as Partial<NewEntry> | undefined)?.type;
        if (type === 'revenue') return value === undefined || value === null;
        return Object.values(EntryPurpose).includes(value as EntryPurpose);
      },
      defaultMessage: (args) =>
        (args?.object as Partial<NewEntry> | undefined)?.type === 'revenue'
          ? 'A receita não tem finalidade.'
          : 'Escolha a finalidade da despesa: pessoal ou familiar.',
    },
  });
}

/** O número de parcelas não passa do total em centavos: toda parcela tem ao menos um centavo. */
function FitsTotalInCents(): PropertyDecorator {
  return ValidateBy({
    name: 'fitsTotalInCents',
    validator: {
      validate: (value, args) => {
        const total = (args?.object as Partial<NewEntry> | undefined)?.totalAmount;
        if (typeof value !== 'number' || typeof total !== 'string') return true;
        let cents: Decimal;
        try {
          cents = new Decimal(total).times(100);
        } catch {
          // O total inválido tem a recusa dele.
          return true;
        }
        return cents.greaterThanOrEqualTo(value);
      },
      defaultMessage: () => 'O total não dá um centavo para cada parcela: diminua o número de parcelas.',
    },
  });
}

export class EntryMonthItem {
  @ApiProperty({ format: 'uuid', description: 'O id do lançamento.' })
  entryId!: string;

  @ApiProperty({ format: 'uuid', description: 'O id da parcela que vence no mês.' })
  installmentId!: string;

  @ApiProperty({ format: 'uuid', description: 'A entidade dona, uma pessoa física.' })
  entityId!: string;

  @ApiProperty({
    description: 'O nome atual da entidade dona, que a lista mostra num contexto com mais de uma.',
    example: ENTITY_NAME_EXAMPLE,
  })
  entityName!: string;

  @ApiProperty({ enum: EntryType, description: ENTRY_TYPE_DESCRIPTION })
  type!: EntryType;

  @ApiProperty({ description: 'A descrição do lançamento.', example: DESCRIPTION_EXAMPLE })
  description!: string;

  @ApiProperty({ description: 'O nome da categoria.', example: CATEGORY_NAME_EXAMPLE })
  categoryName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'O nome da categoria pai, para o caminho ("Moradia › Móveis"), ou nulo na de primeiro nível.',
    example: 'Moradia',
  })
  categoryParentName!: string | null;

  @ApiProperty({ nullable: true, enum: EntryPurpose, description: PURPOSE_DESCRIPTION })
  purpose!: EntryPurpose | null;

  @ApiProperty({ type: 'integer', description: 'O número da parcela, a partir de 1.', example: 3 })
  number!: number;

  @ApiProperty({ type: 'integer', description: 'Quantas parcelas o lançamento tem; 1 no à vista.', example: 10 })
  installmentCount!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'O vencimento da parcela, `AAAA-MM-DD`, no mês pedido.',
    example: '2026-11-10',
  })
  dueDate!: string;

  @ApiProperty({
    description:
      'O valor da parcela, em string decimal com 2 casas, sempre maior que zero: o tipo diz se entra ou sai.',
    example: '450.00',
  })
  amount!: string;

  @ApiProperty({ enum: InstallmentStatus, description: STATUS_DESCRIPTION })
  status!: InstallmentStatus;
}

export class EntryMonthPage extends PageInfo {
  @ApiProperty({
    type: EntryMonthItem,
    isArray: true,
    description:
      'As parcelas da página, cada uma com o lançamento dela, pelo vencimento, da mais recente para a mais antiga.',
  })
  items!: EntryMonthItem[];
}

export class EntryListQuery extends PageQuery {
  @ApiProperty({ description: 'O mês, `AAAA-MM`: a lista traz as parcelas que vencem nele.', example: MONTH_EXAMPLE })
  @IsCalendarMonth({ message: MONTH_MESSAGE })
  month!: string;

  @ApiPropertyOptional({
    enum: EntryType,
    description: '`revenue` traz só as receitas, e `expense`, só as despesas. Sem o parâmetro, traz as duas.',
  })
  @IsOptional()
  @IsEnum(EntryType, { message: 'Escolha o tipo: receita ou despesa.' })
  type?: EntryType;

  @SearchQuery(
    'A busca: o texto procurado na descrição do lançamento, sem diferença de acento nem de maiúsculas, em qualquer posição. Vazia ou ausente, não filtra (LLD, seção 5).',
  )
  q?: string;
}

export class NewEntry {
  @ApiProperty({
    format: 'uuid',
    description: 'A entidade dona, uma pessoa física ativa em que o usuário tem `operate`.',
  })
  @IsUUID('all', { message: 'Escolha a pessoa física.' })
  entityId!: string;

  @ApiProperty({ enum: EntryType, description: ENTRY_TYPE_DESCRIPTION })
  @IsEnum(EntryType, { message: 'Escolha o tipo: receita ou despesa.' })
  type!: EntryType;

  @ApiProperty({
    minLength: 1,
    maxLength: ENTRY_DESCRIPTION_MAX_LENGTH,
    description: 'O que foi, como o usuário o escreve. A api tira os espaços das pontas.',
    example: DESCRIPTION_EXAMPLE,
  })
  @IsTrimmedLength(1, ENTRY_DESCRIPTION_MAX_LENGTH, {
    message: `Informe a descrição, com até ${String(ENTRY_DESCRIPTION_MAX_LENGTH)} caracteres.`,
  })
  description!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'A categoria, ativa e da natureza do tipo: de despesa na despesa, de receita na receita (LLD, seção 4.6).',
  })
  @IsUUID('all', { message: 'Escolha a categoria.' })
  categoryId!: string;

  @ApiPropertyOptional({
    enum: EntryPurpose,
    description: 'A finalidade, obrigatória na despesa e ausente na receita (GLOSSARY.md, Finalidade).',
  })
  @IsPurposeOfType()
  purpose?: EntryPurpose;

  @ApiProperty({ type: String, format: 'date', description: OCCURRED_ON_DESCRIPTION, example: '2026-11-24' })
  @IsCalendarDate({ message: 'Informe a data do fato.' })
  occurredOn!: string;

  @ApiProperty({
    description:
      'O total, a soma das parcelas, em string decimal com até 2 casas, sempre maior que zero: o tipo diz se entra ou sai (LLD, seção 4.1).',
    example: '5399.90',
  })
  @IsDecimalText(TOTAL_AMOUNT_RANGE, { message: 'Informe um total maior que zero, com até 2 casas depois da vírgula.' })
  totalAmount!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MAX_INSTALLMENTS,
    description:
      'Quantas parcelas mensais, de 1 (à vista) a 120. O total é dividido em centavos, com a diferença na primeira (regra 6.21).',
    example: 18,
  })
  @IsInt({ message: INSTALLMENT_COUNT_MESSAGE })
  @Min(1, { message: INSTALLMENT_COUNT_MESSAGE })
  @Max(MAX_INSTALLMENTS, { message: INSTALLMENT_COUNT_MESSAGE })
  @FitsTotalInCents()
  installmentCount!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    description:
      'O vencimento da primeira parcela, ou o recebimento, na receita, `AAAA-MM-DD`. A parcela N vence N−1 meses depois, no mesmo dia, ou no último dia do mês que não tem esse dia (LLD, seção 4.6).',
    example: '2026-12-10',
  })
  @IsCalendarDate({ message: 'Informe o primeiro vencimento.' })
  firstDueDate!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A conta ativa da entidade dona em que as parcelas são pagas ou recebidas.',
  })
  @IsUUID('all', { message: 'Escolha a conta.' })
  accountId!: string;
}

export class Entry {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'A entidade dona, uma pessoa física.' })
  entityId!: string;

  @ApiProperty({ description: 'O nome atual da entidade dona.', example: ENTITY_NAME_EXAMPLE })
  entityName!: string;

  @ApiProperty({ enum: EntryType, description: ENTRY_TYPE_DESCRIPTION })
  type!: EntryType;

  @ApiProperty({ description: 'A descrição.', example: DESCRIPTION_EXAMPLE })
  description!: string;

  @ApiProperty({ format: 'uuid', description: 'A categoria, da natureza do tipo.' })
  categoryId!: string;

  @ApiProperty({ description: 'O nome atual da categoria.', example: CATEGORY_NAME_EXAMPLE })
  categoryName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'O nome da categoria pai, para o caminho, ou nulo na de primeiro nível.',
    example: 'Moradia',
  })
  categoryParentName!: string | null;

  @ApiProperty({ nullable: true, enum: EntryPurpose, description: PURPOSE_DESCRIPTION })
  purpose!: EntryPurpose | null;

  @ApiProperty({ type: String, format: 'date', description: OCCURRED_ON_DESCRIPTION, example: '2026-11-24' })
  occurredOn!: string;

  @ApiProperty({ description: 'O total, a soma das parcelas, em string decimal com 2 casas.', example: '5399.90' })
  totalAmount!: string;

  @ApiProperty({ type: 'integer', description: 'Quantas parcelas o lançamento tem; 1 no à vista.', example: 18 })
  installmentCount!: number;

  @ApiProperty({ type: 'integer', description: 'A versão, que a edição manda de volta (regra 6.20).', example: 1 })
  version!: number;
}

export class Installment {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'integer', description: 'O número da parcela, a partir de 1.', example: 1 })
  number!: number;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'O vencimento, ou o recebimento, na receita, `AAAA-MM-DD`.',
    example: '2026-12-10',
  })
  dueDate!: string;

  @ApiProperty({ description: 'O valor, em string decimal com 2 casas, sempre maior que zero.', example: '300.07' })
  amount!: string;

  @ApiProperty({ format: 'uuid', description: 'A conta em que a parcela é paga ou recebida.' })
  accountId!: string;

  @ApiProperty({ description: 'O nome atual da conta.', example: 'Nubank' })
  accountName!: string;

  @ApiProperty({ enum: InstallmentStatus, description: STATUS_DESCRIPTION })
  status!: InstallmentStatus;
}

export class InstallmentPage extends PageInfo {
  @ApiProperty({ type: Installment, isArray: true, description: 'As parcelas da página, pelo número.' })
  items!: Installment[];
}

export class EntryId {
  @ApiProperty({ format: 'uuid', description: 'O id do lançamento.' })
  @IsUUID('all', { message: 'O id do lançamento não é válido.' })
  id!: string;
}
