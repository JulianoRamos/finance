import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Não anuncia o Next no cabeçalho X-Powered-By.
  poweredByHeader: false,
  // Os testes de ponta a ponta abrem a web em 127.0.0.1 (playwright.config.ts). Sem esta liberação, o
  // modo de desenvolvimento recusa o HMR dessa origem, e as páginas não hidratam.
  allowedDevOrigins: ['127.0.0.1'],
  // O indicador do modo de desenvolvimento fica à direita, para não cobrir o botão da conta, no rodapé da
  // barra lateral.
  devIndicators: { position: 'bottom-right' },
  // O repasse do console do navegador grava o log do modo de desenvolvimento a cada carga, e a gravação
  // dispara uma recompilação que recarrega a página: com o HMR conectado, a página entrava num laço.
  logging: { browserToTerminal: false },
};

export default nextConfig;
