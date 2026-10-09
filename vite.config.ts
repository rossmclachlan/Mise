import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Mise lives at /Mise/meals/ and Priorities at /Mise/priorities/: side-by-side
// scopes, so each installs as its own app and neither captures the other's
// pages. /Mise/ itself only redirects here (see root/).
export default defineConfig({
  base: '/Mise/meals/',
  build: {
    outDir: fileURLToPath(new URL('./dist/meals', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Mis En Pizza',
        short_name: 'Mis En Pizza',
        description: 'Personal meal planning and grocery app',
        theme_color: '#FFF5D6',
        background_color: '#FFF5D6',
        display: 'standalone',
        id: '/Mise/meals/',
        start_url: '/Mise/meals/',
        scope: '/Mise/meals/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
