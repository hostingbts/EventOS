import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { gasProxyPlugin } from './vite-gas-proxy';

// On GitHub Pages the app lives at /EventOS/
// Override via VITE_BASE_URL env var (e.g. "/" for a custom domain).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_URL ?? '/';
  const useProxy = env.VITE_USE_PROXY === 'true';

  return {
  base,
  build: {
    chunkSizeWarningLimit: 3000,
    reportCompressedSize: false,
  },
  plugins: [
    ...(useProxy ? [gasProxyPlugin(env.VITE_API_URL, env.VITE_API_TOKEN)] : []),
    react(),
    // Skip PWA generation in CI — workbox can fail with non-root base paths
    ...(process.env.CI === 'true'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon-32.png', 'eventos-icon.svg', 'eventos-icon-reversed.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'EventOS',
              short_name: 'EventOS',
              description: 'Event Operations Execution Platform',
              theme_color: '#0f172a',
              background_color: '#f0f4f8',
              display: 'standalone',
              orientation: 'portrait',
              start_url: base,
              scope: base,
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
        ]),
  ],
  };
});
