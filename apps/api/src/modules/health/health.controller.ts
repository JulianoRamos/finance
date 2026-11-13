import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/index.js';
import { Health } from './health.dto.js';
import { HealthService } from './health.service.js';

/** A rota de saúde, pública: o healthcheck do Compose e a página inicial da web a chamam. */
@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'O estado da api e do banco. Rota pública.' })
  @ApiOkResponse({ type: Health, description: 'O banco respondeu.' })
  @ApiServiceUnavailableResponse({ type: Health, description: 'O banco não respondeu dentro do prazo.' })
  async check(): Promise<Health> {
    const health: Health = { database: await this.health.databaseState() };
    if (health.database === 'down') {
      throw new HttpException(health, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
