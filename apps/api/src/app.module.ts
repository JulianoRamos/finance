import { Module } from '@nestjs/common';

import { CommonModule } from './common/index.js';
import { AuditModule } from './modules/audit/index.js';
import { HealthModule } from './modules/health/index.js';

@Module({
  imports: [CommonModule, AuditModule, HealthModule],
})
export class AppModule {}
