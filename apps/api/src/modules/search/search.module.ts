import { Module } from '@nestjs/common';

import { EntitiesModule } from '../entities/index.js';
import { IdentityModule } from '../identity/index.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [EntitiesModule, IdentityModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
