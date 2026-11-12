import { Module } from '@nestjs/common';

import { CommonModule } from './common/index.js';
import { HealthModule } from './modules/health/index.js';

@Module({
  imports: [CommonModule, HealthModule],
})
export class AppModule {}
