import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/Mise/',
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
        theme_color: '#4A6741',
        background_color: '#FAFAF8',
        display: 'standalone',
        start_url: '/Mise/',
        scope: '/Mise/',
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
