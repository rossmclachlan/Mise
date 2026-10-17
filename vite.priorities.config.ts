import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Priorities, the shared to-do app, is a second app in this repo. It builds into
// dist/priorities/ after Mise, with its own manifest and service worker scoped to
// /Mise/priorities/, so it installs to the home screen as a separate app.
export default defineConfig({
  root: fileURLToPath(new URL('./priorities', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  base: '/Mise/priorities/',
  build: {
    outDir: fileURLToPath(new URL('./dist/priorities', import.meta.url)),
    emptyOutDir: true,
  },
  server: { port: 5174 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Updates install as the app opens, or from the Install bar if one turns
      // up while it's open (src/hooks/usePWAUpdate.ts), never mid-use.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      // Shows and opens notifications (public/push-sw.js).
      workbox: { importScripts: ['push-sw.js'] },
      manifest: {
        id: '/Mise/priorities/',
        name: 'Priorities',
        short_name: 'Priorities',
        description: 'Our week, taken care of',
        theme_color: '#EDF1E2',
        background_color: '#EDF1E2',
        display: 'standalone',
        start_url: '/Mise/priorities/',
        scope: '/Mise/priorities/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
