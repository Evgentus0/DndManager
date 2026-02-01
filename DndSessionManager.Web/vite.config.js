import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'esnext',
    outDir: 'wwwroot/dist',
    manifest: true,
    rollupOptions: {
      input: {
        main: './wwwroot/ClientApp/main.js'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './wwwroot/ClientApp')
    }
  }
})
