import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/index.js';
import { EntitiesModule } from '../entities/index.js';
import { IdentityModule } from '../identity/index.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [EntitiesModule, AccountsModule, IdentityModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
