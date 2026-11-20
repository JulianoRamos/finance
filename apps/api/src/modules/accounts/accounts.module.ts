import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/index.js';
import { EntitiesModule } from '../entities/index.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [AuditModule, EntitiesModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  // A Pesquisa procura as contas (regra 6.22).
  exports: [AccountsService],
})
export class AccountsModule {}
