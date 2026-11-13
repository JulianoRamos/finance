import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/** Os cabeçalhos do navegador que a web repassa às rotas públicas da Identidade (regra 6.1). */
export function ApiClientHeaders(options: { userAgent: boolean }): MethodDecorator & ClassDecorator {
  const forwardedFor = ApiHeader({
    name: 'X-Forwarded-For',
    description:
      'O endereço do navegador, que a web repassa. A api conta as tentativas por ele (regra 6.1); sem o cabeçalho, vale o endereço da conexão.',
    required: false,
  });
  const userAgent = ApiHeader({
    name: 'User-Agent',
    description: 'O User-Agent do navegador, que a web repassa, guardado na sessão.',
    required: false,
  });
  return options.userAgent ? applyDecorators(forwardedFor, userAgent) : applyDecorators(forwardedFor);
}
