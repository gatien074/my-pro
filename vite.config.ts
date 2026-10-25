import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Caisse & Stock — Gestion pour petits commerces',
        short_name: 'Caisse & Stock',
        description:
          "Gestion de caisse, de stock, de dettes clients et de rapports pour boutiques, quincailleries, pharmacies, restaurants et alimentations. Fonctionne 100% hors ligne.",
        lang: 'fr',
        dir: 'ltr',
        theme_color: '#123f2c',
        background_color: '#f5f7f4',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
