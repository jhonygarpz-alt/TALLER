import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

declare const process: { env: Record<string, string | undefined> }

// BASE_PATH permite publicar en una subruta (p. ej. GitHub Pages: /TALLER/)
// Entradas: sistema web, app de órdenes (movil/), app de técnicos (tecnicos/) y app del cliente (cliente/)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: { web: 'index.html', movil: 'movil/index.html', tecnicos: 'tecnicos/index.html', cliente: 'cliente/index.html' },
    },
  },
})
