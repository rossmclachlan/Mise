import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Tandem, the shared to-do app, is a second app in this repo. It builds into
// dist/tandem/ after Mise, with its own manifest and service worker scoped to
// /Mise/tandem/, so it installs to the home screen as a separate app.
export default defineConfig({
  root: fileURLToPath(new URL('./tandem', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  base: '/Mise/tandem/',
  build: {
    outDir: fileURLToPath(new URL('./dist/tandem', import.meta.url)),
    emptyOutDir: true,
  },
  server: { port: 5174 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/Mise/tandem/',
        name: 'Tandem',
        short_name: 'Tandem',
        description: 'Our week, taken care of',
        theme_color: '#3D5A80',
        background_color: '#F7F6F1',
        display: 'standalone',
        start_url: '/Mise/tandem/',
        scope: '/Mise/tandem/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
