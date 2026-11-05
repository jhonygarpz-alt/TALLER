import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '../index.css'
import { AuthProvider } from '../lib/auth'
import AppGerencia from './AppGerencia'

// Service worker: permite instalar la app y abrirla rápido aunque la señal sea mala
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}gerencia/sw.js`, { scope: `${import.meta.env.BASE_URL}gerencia/` }).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider><AppGerencia /></AuthProvider>
    </HashRouter>
  </StrictMode>,
)
