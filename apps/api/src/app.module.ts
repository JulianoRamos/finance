import { Module } from '@nestjs/common';

import { ComumModule } from './comum/index.js';
import { SaudeModule } from './modulos/saude/index.js';

@Module({
  imports: [ComumModule, SaudeModule],
})
export class AppModule {}
