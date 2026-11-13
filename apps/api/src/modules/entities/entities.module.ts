import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/index.js';
import { EntitiesController } from './entities.controller.js';
import { EntitiesService } from './entities.service.js';

@Module({
  imports: [AuditModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
})
export class EntitiesModule {}
