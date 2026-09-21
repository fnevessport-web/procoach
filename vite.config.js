import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { previewReposicao } from './scripts/vitePreviewReposicao.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    previewReposicao(),
  ],
  resolve: {
    alias: { '@': '/src' }
  }
})