import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/index.js';
import { EntitiesModule } from '../entities/index.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

// O módulo Lançamentos (LLD, seção 3): por enquanto, só a árvore de categorias das pessoas físicas.
@Module({
  imports: [AuditModule, EntitiesModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // A Pesquisa procura as categorias (regra 6.22).
  exports: [CategoriesService],
})
export class EntriesModule {}
