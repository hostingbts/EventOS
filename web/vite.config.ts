import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// On GitHub Pages the app lives at /EventOS/
// Override via VITE_BASE_URL env var (e.g. "/" for a custom domain).
const base = process.env.VITE_BASE_URL ?? '/';

export default defineConfig({
  base,
  build: {
    chunkSizeWarningLimit: 3000,
    reportCompressedSize: false,
  },
  plugins: [
    react(),
    // Skip PWA generation in CI — workbox can fail with non-root base paths
    ...(process.env.CI === 'true'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'logo.png'],
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
});
