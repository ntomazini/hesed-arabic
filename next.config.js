/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/app',

  async redirects() {
    return [
      { source: '/', destination: '/app/login', permanent: false, basePath: false },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impede que a página seja embutida em iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Impede que o browser adivinhe o tipo de conteúdo (MIME sniffing)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Ativa proteção XSS do browser (legado, mas ainda útil)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Não envia Referer para sites externos
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restringe features do browser (câmera, microfone, etc.)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: força HTTPS por 1 ano (ativar quando SSL estiver pronto)
          // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // Headers específicos para as APIs — impede cache de dados sensíveis
        source: '/app/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
