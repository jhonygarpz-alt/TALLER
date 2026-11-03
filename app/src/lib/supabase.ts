import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en .env.local')
}

/**
 * "Recordar mi sesión": la sesión de Supabase (los mismos tokens de siempre) se guarda en
 * localStorage si se recuerda (sobrevive a cerrar el navegador) o en sessionStorage si no
 * (se pierde al cerrar la pestaña/navegador). La validación y expiración no cambian.
 */
const RECORDAR = 'recordar-sesion'
export const recordarSesion = () => { try { return localStorage.getItem(RECORDAR) !== 'no' } catch { return true } }
export function setRecordarSesion(si: boolean) { try { localStorage.setItem(RECORDAR, si ? 'si' : 'no') } catch { /* sin almacenamiento */ } }

const almacen = {
  getItem: (k: string) => { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => {
    try {
      const [usar, limpiar] = recordarSesion() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
      usar.setItem(k, v); limpiar.removeItem(k)
    } catch { /* sin almacenamiento */ }
  },
  removeItem: (k: string) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch { /* sin almacenamiento */ } },
}

export const supabase = createClient(url, key, { auth: { storage: almacen, persistSession: true, autoRefreshToken: true } })
