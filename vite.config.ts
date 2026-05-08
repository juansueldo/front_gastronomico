import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredTarget = env.VITE_PROXY_TARGET || env.VITE_API_URL || 'http://localhost:3000';
  const proxyTarget = configuredTarget.replace(/^ws/i, 'http');

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used - do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/v1': {
          target: proxyTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (error: NodeJS.ErrnoException, _req, res) => {
              const response = res as any;

              if (!response.headersSent) {
                response.writeHead(502, { 'Content-Type': 'application/json' });
              }

              response.end(JSON.stringify({
                error: 'backend_unreachable',
                code: error.code ?? 'PROXY_ERROR',
                target: proxyTarget,
              }));
            });
          },
        },
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
  };
})
