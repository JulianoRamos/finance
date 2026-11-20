import { Injectable } from '@nestjs/common';

import { EntitiesService, FinancialGroupsService } from '../entities/index.js';
import { type AuthenticatedSession, IdentityService } from '../identity/index.js';
import type { SearchResults } from './search.dto.js';

/** Quantos resultados a pesquisa traz de cada tipo (regra 6.22). */
const RESULTS_PER_TYPE = 5;

/**
 * A pesquisa (regra 6.22): junta o que cada módulo acha pelo termo. Quem decide o que o usuário vê é o
 * dono de cada registro: as Entidades leem as permissões do usuário da requisição, e a Identidade, a sessão.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly entities: EntitiesService,
    private readonly groups: FinancialGroupsService,
    private readonly identity: IdentityService,
  ) {}

  async search(session: AuthenticatedSession, term: string): Promise<SearchResults> {
    const [entities, financialGroups, users] = await Promise.all([
      this.entities.search(term, RESULTS_PER_TYPE),
      this.groups.search(term, RESULTS_PER_TYPE),
      this.identity.searchUsers(session, term, RESULTS_PER_TYPE),
    ]);
    return { entities, financialGroups, users };
  }
}
