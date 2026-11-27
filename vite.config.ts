import { copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const root = path.dirname(fileURLToPath(import.meta.url))

function githubPages404(): Plugin {
  return {
    name: 'github-pages-404',
    apply: 'build',
    closeBundle() {
      const index = path.resolve(root, 'dist/index.html')
      copyFileSync(index, path.resolve(root, 'dist/404.html'))
    },
  }
}

export default defineConfig({
  base: '/ledger/',
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '雙店帳簿',
        short_name: '雙店帳簿',
        description: '諾奇意咖啡與拉亞漢堡新莊店的收支帳簿',
        lang: 'zh-Hant-TW',
        dir: 'ltr',
        display: 'standalone',
        start_url: '/ledger/',
        scope: '/ledger/',
        background_color: '#f3ecdf',
        theme_color: '#2a211c',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        navigateFallback: '/ledger/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
    githubPages404(),
  ],
  server: {
    host: '127.0.0.1',
    port: 43123,
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
  },
})
