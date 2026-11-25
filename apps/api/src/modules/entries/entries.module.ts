import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/index.js';
import { AuditModule } from '../audit/index.js';
import { EntitiesModule } from '../entities/index.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { EntriesController } from './entries.controller.js';
import { EntriesService } from './entries.service.js';

// O módulo Lançamentos (LLD, seção 3): a árvore de categorias e os lançamentos das pessoas físicas, com
// as parcelas.
@Module({
  imports: [AccountsModule, AuditModule, EntitiesModule],
  controllers: [CategoriesController, EntriesController],
  providers: [CategoriesService, EntriesService],
  // A Pesquisa procura as categorias (regra 6.22).
  exports: [CategoriesService],
})
export class EntriesModule {}
