import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ApiError, UNAUTHENTICATED_RESPONSE } from '../../common/index.js';
import { type AuthenticatedSession, CurrentSessionOf } from '../identity/index.js';
import { SearchResults, SearchTermQuery } from './search.dto.js';
import { SearchService } from './search.service.js';

// A pesquisa procura em todos os contextos do usuário, então não lê o Financial-Context (regra 6.22).
@ApiTags('search')
@ApiBearerAuth('session')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Pesquisa entidades, grupos financeiros, contas, categorias e usuários pelo nome.' })
  @ApiOkResponse({
    type: SearchResults,
    description:
      'Até 5 resultados por tipo, em todos os contextos do usuário (regra 6.22): as entidades em que ele tem permissão, os grupos em que ele tem permissão em todos os membros, as contas das entidades em que ele tem permissão, as categorias das pessoas físicas, quando ele tem permissão em alguma, e, só para quem gere acessos, os usuários.',
  })
  @ApiBadRequestResponse({
    type: ApiError,
    description:
      '`INVALID_INPUT`: o termo falta, ou tem menos de 2 ou mais de 120 caracteres sem contar os espaços das pontas (em `fields`).',
  })
  @ApiUnauthorizedResponse(UNAUTHENTICATED_RESPONSE)
  search(@Query() query: SearchTermQuery, @CurrentSessionOf() session: AuthenticatedSession): Promise<SearchResults> {
    return this.searchService.search(session, query.term);
  }
}
