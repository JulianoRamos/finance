import { Module } from '@nestjs/common';

import { CommonModule } from './common/index.js';
import { AuditModule } from './modules/audit/index.js';
import { EntitiesModule } from './modules/entities/index.js';
import { HealthModule } from './modules/health/index.js';
import { IdentityModule } from './modules/identity/index.js';

@Module({
  imports: [CommonModule, AuditModule, HealthModule, IdentityModule, EntitiesModule],
})
export class AppModule {}
