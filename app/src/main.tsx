import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useActualizacionAutomatica } from './lib/version'

function Actualizador() { useActualizacionAutomatica(); return null }

import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/auth'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Actualizador /><AuthProvider><App /></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
