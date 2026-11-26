import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/index.js';
import { AuditModule } from '../audit/index.js';
import { EntriesModule } from '../entries/index.js';
import { ReconciliationController } from './reconciliation.controller.js';
import { ReconciliationService } from './reconciliation.service.js';

// O módulo Conciliação (LLD, seção 3): por enquanto, só o pagamento das parcelas, que liga a movimentação
// manual à parcela que ela paga.
@Module({
  imports: [AccountsModule, AuditModule, EntriesModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
