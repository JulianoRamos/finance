import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Saude } from './saude.dto.js';
import { SaudeService } from './saude.service.js';

/** A rota de saúde, pública: o healthcheck do Compose e a página inicial da web a chamam. */
@ApiTags('saude')
@Controller('saude')
export class SaudeController {
  constructor(private readonly saude: SaudeService) {}

  @Get()
  @ApiOperation({ summary: 'O estado da api e do banco. Rota pública.' })
  @ApiOkResponse({ type: Saude, description: 'O banco respondeu.' })
  @ApiServiceUnavailableResponse({ type: Saude, description: 'O banco não respondeu dentro do prazo.' })
  async verificar(): Promise<Saude> {
    const saude: Saude = { banco: await this.saude.estadoDoBanco() };
    if (saude.banco === 'fora_do_ar') {
      throw new HttpException(saude, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return saude;
  }
}
