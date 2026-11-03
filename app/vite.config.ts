import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

declare const process: { env: Record<string, string | undefined> }

// BASE_PATH permite publicar en una subruta (p. ej. GitHub Pages: /TALLER/)
// Dos entradas: el sistema web (index.html) y la app móvil instalable (movil/index.html)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { web: 'index.html', movil: 'movil/index.html' },
    },
  },
})
