import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Perfil { id: string; email: string; nombre: string; rol: string; activo: boolean }
interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  puede: (p: string) => boolean
  recargar: () => Promise<void>
}
const Ctx = createContext<AuthCtx>({ session: null, perfil: null, puede: () => false, recargar: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [permisos, setPermisos] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); setPermisos(new Set()); setCargando(false); return }
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', s.user.id).maybeSingle()
    setPerfil(p as Perfil | null)
    if (p?.activo) {
      const { data: rp } = await supabase.from('rol_permisos').select('permiso').eq('rol', p.rol)
      setPermisos(new Set((rp ?? []).map(r => r.permiso)))
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); cargarPerfil(data.session) })
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      setSession(s)
      if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') { setCargando(true); cargarPerfil(s) }
    })
    return () => data.subscription.unsubscribe()
  }, [cargarPerfil])

  const puede = useCallback((p: string) => !!perfil?.activo && (perfil.rol === 'direccion' || permisos.has(p)), [perfil, permisos])

  if (session === undefined || cargando) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Cargando…</div>
  }
  return <Ctx.Provider value={{ session, perfil, puede, recargar: () => cargarPerfil(session) }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
