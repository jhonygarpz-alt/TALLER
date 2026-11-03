import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import '../index.css'
import { leerToken } from './api'
import Acceso from './pantallas/Acceso'
import Seguimiento from './pantallas/Seguimiento'
import Encuesta from './pantallas/Encuesta'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}cliente/sw.js`, { scope: `${import.meta.env.BASE_URL}cliente/` }).catch(() => {})
  })
}

function AppCliente() {
  const [token, setToken] = useState<string | null>(leerToken)
  if (!token) return <Acceso onListo={setToken} />
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 text-slate-800">
      <Routes>
        <Route path="/encuesta/:id" element={<Encuesta token={token} />} />
        <Route path="*" element={<Seguimiento token={token} onSalir={() => setToken(null)} />} />
      </Routes>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><HashRouter><AppCliente /></HashRouter></StrictMode>,
)
