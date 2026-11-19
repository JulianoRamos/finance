import { Module } from '@nestjs/common';

import { AuditHistoryService } from './audit-history.service.js';
import { AuditService } from './audit.service.js';
import { UserNamesRegistry } from './user-names.js';

@Module({
  providers: [AuditService, AuditHistoryService, UserNamesRegistry],
  // A Identidade registra a porta dos nomes no UserNamesRegistry (LLD, seção 3).
  exports: [AuditService, AuditHistoryService, UserNamesRegistry],
})
export class AuditModule {}
