import { Module } from '@nestjs/common';

import { CommonModule } from './common/index.js';
import { AccountsModule } from './modules/accounts/index.js';
import { AuditModule } from './modules/audit/index.js';
import { EntitiesModule } from './modules/entities/index.js';
import { EntriesModule } from './modules/entries/index.js';
import { HealthModule } from './modules/health/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { ReconciliationModule } from './modules/reconciliation/index.js';
import { SearchModule } from './modules/search/index.js';

@Module({
  imports: [
    CommonModule,
    AuditModule,
    HealthModule,
    IdentityModule,
    EntitiesModule,
    SearchModule,
    AccountsModule,
    EntriesModule,
    ReconciliationModule,
  ],
})
export class AppModule {}
