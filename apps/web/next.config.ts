import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Não anuncia o Next no cabeçalho X-Powered-By.
  poweredByHeader: false,
};

export default nextConfig;
