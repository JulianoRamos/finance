import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/index.js';
import { EntitiesController } from './entities.controller.js';
import { EntitiesService } from './entities.service.js';
import { EquityStakesController } from './equity-stakes.controller.js';
import { EquityStakesService } from './equity-stakes.service.js';
import { FinancialContextController } from './financial-context.controller.js';
import { FinancialContextService } from './financial-context.service.js';
import { FinancialGroupsController } from './financial-groups.controller.js';
import { FinancialGroupsService } from './financial-groups.service.js';

@Module({
  imports: [AuditModule],
  controllers: [EntitiesController, FinancialGroupsController, FinancialContextController, EquityStakesController],
  providers: [EntitiesService, EquityStakesService, FinancialGroupsService, FinancialContextService],
  // A Identidade lê as entidades para a tabela de permissões e resolve o contexto financeiro para
  // conferir a permissão nele (LLD, seção 3).
  exports: [EntitiesService, FinancialContextService],
})
export class EntitiesModule {}
