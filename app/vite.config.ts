import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

declare const process: { env: Record<string, string | undefined> }

// Identificador de cada publicación: las apps lo comparan con /version.json para recargarse solas
const BUILD = String(Date.now())

// BASE_PATH permite publicar en una subruta (p. ej. GitHub Pages: /TALLER/)
// Entradas: sistema web, app de órdenes (movil/), app de técnicos (tecnicos/) , app del cliente (cliente/) y app de gerencia (gerencia/)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), tailwindcss(), {
    name: 'version-json',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) },
  }],
  build: {
    rollupOptions: {
      input: { web: 'index.html', movil: 'movil/index.html', tecnicos: 'tecnicos/index.html', cliente: 'cliente/index.html', gerencia: 'gerencia/index.html' },
    },
  },
})
