import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiError, pageRequest, parseCalendarMonth, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { CategoriesService } from './categories.service.js';
import {
  Category,
  CategoryActivation,
  CategoryEdit,
  CategoryId,
  CategoryListQuery,
  CategoryTreePage,
  NewCategory,
} from './entries.dto.js';

/** O parâmetro do id da categoria, como o contrato o descreve. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'O id da categoria.' } as const;

const NOT_FOUND_RESPONSE = { type: ApiError, description: '`NOT_FOUND`: a categoria não existe.' };
const VERSION_CONFLICT_RESPONSE = {
  type: ApiError,
  description: '`VERSION_CONFLICT`: a `version` enviada não é a atual: a categoria mudou desde a leitura (regra 6.20).',
};

const OPERATE_FORBIDDEN_RESPONSE = {
  type: ApiError,
  description:
    '`FORBIDDEN`: o usuário não tem `operate` em nenhuma pessoa física: a árvore das pessoas físicas é de todas elas (LLD, seção 4.6).',
};

// A árvore das pessoas físicas é de todas elas, então as rotas não leem o Financial-Context: a permissão
// é a de alguma pessoa física, `view` para ler e `operate` para alterar, conferida pelo serviço (LLD,
// seção 4.6).
@ApiTags('categories')
@ApiBearerAuth('session')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista a árvore de categorias das pessoas físicas de uma natureza.' })
  @ApiOkResponse({
    type: CategoryTreePage,
    description:
      'A página das categorias de primeiro nível da natureza, com o total delas (LLD, seção 5), cada uma com as subcategorias e o total do mês: a paginação é pelo primeiro nível, para nenhuma categoria ficar dividida entre duas páginas.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: a natureza falta ou não é `revenue` nem `expense`, o `active` não é `true` nem `false`, o mês não é `AAAA-MM`, a `page` não é um inteiro a partir de 1, ou o `pageSize` não é um inteiro de 1 a 100 (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse({
    type: ApiError,
    description:
      '`FORBIDDEN`: o usuário não tem `view` nem `operate` em nenhuma pessoa física: a árvore das pessoas físicas é de todas elas (LLD, seção 4.6).',
  })
  list(@Query() query: CategoryListQuery): Promise<CategoryTreePage> {
    return this.categories.list({
      nature: query.nature,
      active: query.active === undefined ? undefined : query.active === 'true',
      q: query.q,
      month: parseCalendarMonth(query.month) ?? undefined,
      page: pageRequest(query),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma categoria ou subcategoria na árvore das pessoas físicas.' })
  @ApiCreatedResponse({ type: Category, description: 'A categoria foi criada, ativa, na versão 1.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o nome falta, é vazio ou passa de 120 caracteres, o pai não é um UUID, ou a natureza falta sem o pai ou não é `revenue` nem `expense` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`INVALID_PARENT`: o pai não existe. `CATEGORY_TOO_DEEP`: o pai já é uma subcategoria: a árvore tem dois níveis. `PARENT_NATURE_MISMATCH`: o pai é de outra natureza. `INACTIVE_PARENT`: o pai está desativado (LLD, seção 4.6).',
  })
  create(@Body() body: NewCategory): Promise<Category> {
    return this.categories.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Renomeia uma categoria ou muda o pai dela.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ type: Category, description: 'A categoria editada, na versão seguinte.' })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o id não é um UUID, a versão falta, o nome falta, é vazio ou passa de 120 caracteres, o pai não é um UUID nem nulo, ou a natureza falta ou não é `revenue` nem `expense` (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`CATEGORY_NATURE_IMMUTABLE`: a natureza enviada não é a atual. `INVALID_PARENT`: o pai não existe ou é a própria categoria. `CATEGORY_TOO_DEEP`: o pai já é uma subcategoria, ou a categoria tem subcategorias e iria para dentro de outra. `PARENT_NATURE_MISMATCH`: o pai é de outra natureza. `INACTIVE_PARENT`: o pai está desativado (LLD, seção 4.6).',
  })
  update(@Param() params: CategoryId, @Body() body: CategoryEdit): Promise<Category> {
    return this.categories.update(params.id, body);
  }

  @Put(':id/active')
  @ApiOperation({ summary: 'Desativa ou reativa uma categoria.' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({
    type: Category,
    description:
      'A categoria desativada ou reativada, com a versão seguinte. Desativar a de primeiro nível desativa as subcategorias dela junto; reativar reativa só ela. Pedir o estado que ela já tem responde 200 sem mudar a versão. Desativar não apaga nada (regra 6.20).',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description: '`INVALID_INPUT`: o id não é um UUID, ou o `active` ou a versão faltam (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  @ApiForbiddenResponse(OPERATE_FORBIDDEN_RESPONSE)
  @ApiNotFoundResponse(NOT_FOUND_RESPONSE)
  @ApiConflictResponse(VERSION_CONFLICT_RESPONSE)
  @ApiUnprocessableEntityResponse({
    type: ApiError,
    description:
      '`INACTIVE_PARENT`: a subcategoria não é reativada enquanto o pai dela estiver desativado (LLD, seção 4.6).',
  })
  setActive(@Param() params: CategoryId, @Body() body: CategoryActivation): Promise<Category> {
    return this.categories.setActive(params.id, body.active, body.version);
  }
}
