import { ApiProperty } from '@nestjs/swagger';

import { EntityType, Institution, IsTrimmedLength, NAME_MAX_LENGTH } from '../../common/index.js';

/**
 * O menor termo da pesquisa, sem os espaços das pontas (regra 6.22). A paleta da web não pede à api um termo
 * menor (`MIN_TERM_LENGTH`, na estrutura do app).
 */
const TERM_MIN_LENGTH = 2;

export class SearchTermQuery {
  @ApiProperty({
    minLength: TERM_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
    description:
      'O termo procurado no nome, de 2 a 120 caracteres sem contar os espaços das pontas, sem diferença de acento nem de maiúsculas, em qualquer posição (regra 6.22).',
  })
  @IsTrimmedLength(TERM_MIN_LENGTH, NAME_MAX_LENGTH, {
    message: `Digite de ${String(TERM_MIN_LENGTH)} a ${String(NAME_MAX_LENGTH)} caracteres para pesquisar.`,
  })
  term!: string;
}

export class SearchEntity {
  @ApiProperty({ format: 'uuid', description: 'O id da entidade.' })
  id!: string;

  @ApiProperty({ enum: EntityType, description: 'Pessoa física (`individual`) ou jurídica (`company`).' })
  type!: EntityType;

  @ApiProperty({ description: 'O nome da entidade.', example: 'Ana Lima' })
  name!: string;

  @ApiProperty({
    description: 'Falso na entidade desativada, que aparece marcada como tal e não é escolha de contexto (regra 6.2).',
  })
  active!: boolean;
}

export class SearchFinancialGroup {
  @ApiProperty({ format: 'uuid', description: 'O id do grupo.' })
  id!: string;

  @ApiProperty({ description: 'O nome do grupo.', example: 'Visão Familiar' })
  name!: string;

  @ApiProperty({ description: 'Verdadeiro só na Visão Familiar.' })
  isFamilyView!: boolean;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Quantas pessoas físicas o grupo reúne, ativas ou não, para o resumo do grupo.',
  })
  individuals!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description: 'Quantas empresas o grupo reúne, ativas ou não, para o resumo do grupo.',
  })
  companies!: number;
}

export class SearchAccount {
  @ApiProperty({ format: 'uuid', description: 'O id da conta.' })
  id!: string;

  @ApiProperty({ description: 'O nome da conta.', example: 'Nubank' })
  name!: string;

  @ApiProperty({ description: 'O nome da entidade dona, para o complemento.', example: 'Ana Lima' })
  entityName!: string;

  @ApiProperty({
    enum: Institution,
    description:
      'O banco, que escolhe o leitor dos extratos importados (regra 6.4). `other` para um banco que a importação não lê e para o dinheiro em espécie.',
  })
  institution!: Institution;

  @ApiProperty({ description: 'Verdadeiro na conta de reserva.' })
  isReserve!: boolean;

  @ApiProperty({ description: 'Falso na conta desativada, que aparece marcada como tal.' })
  active!: boolean;
}

export class SearchUser {
  @ApiProperty({ format: 'uuid', description: 'O id do usuário.' })
  id!: string;

  @ApiProperty({ description: 'O nome do usuário.', example: 'Bruno Lima' })
  name!: string;

  @ApiProperty({ description: 'O e-mail, que é o login, em minúsculas.', example: 'bruno@exemplo.com' })
  email!: string;

  @ApiProperty({ description: 'Falso no usuário desativado, que não entra (regra 6.1).' })
  active!: boolean;
}

export class SearchResults {
  @ApiProperty({
    type: SearchEntity,
    isArray: true,
    description:
      'Até 5 entidades em que o usuário tem `view` ou `operate`, as ativas primeiro, e cada grupo pelo nome.',
  })
  entities!: SearchEntity[];

  @ApiProperty({
    type: SearchFinancialGroup,
    isArray: true,
    description:
      'Até 5 grupos em que o usuário tem permissão em todos os membros (o grupo vazio entra), a Visão Familiar primeiro e os outros pelo nome.',
  })
  financialGroups!: SearchFinancialGroup[];

  @ApiProperty({
    type: SearchAccount,
    isArray: true,
    description:
      'Até 5 contas das entidades em que o usuário tem `view` ou `operate`, as ativas primeiro, e cada grupo pelo nome.',
  })
  accounts!: SearchAccount[];

  @ApiProperty({
    type: SearchUser,
    isArray: true,
    description: 'Até 5 usuários, os ativos primeiro, e cada grupo pelo nome. Sempre vazia para quem não gere acessos.',
  })
  users!: SearchUser[];
}
