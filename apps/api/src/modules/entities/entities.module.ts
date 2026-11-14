import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/index.js';
import { EntitiesController } from './entities.controller.js';
import { EntitiesService } from './entities.service.js';
import { FinancialGroupsController } from './financial-groups.controller.js';
import { FinancialGroupsService } from './financial-groups.service.js';

@Module({
  imports: [AuditModule],
  controllers: [EntitiesController, FinancialGroupsController],
  providers: [EntitiesService, FinancialGroupsService],
  // A Identidade lê as entidades para a tabela de permissões (LLD, seção 3).
  exports: [EntitiesService],
})
export class EntitiesModule {}
