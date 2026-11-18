import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Perfil { id: string; email: string; nombre: string; rol: string; activo: boolean; cambiar_password?: boolean }
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
  // Los técnicos solo usan su app (Mis trabajos)
  const base = import.meta.env.BASE_URL
  const enAppTecnicos = window.location.pathname.startsWith(`${base}tecnicos`)
  const soloSuApp = !!session && !!perfil?.activo && perfil.rol === 'tecnico' && !enAppTecnicos
  return (
    <Ctx.Provider value={{ session, perfil, puede, recargar: () => cargarPerfil(session) }}>
      {soloSuApp ? <SoloAppTecnicos nombre={perfil!.nombre} url={`${base}tecnicos/`} /> : children}
      {session && perfil?.activo && perfil.cambiar_password && <PreguntaCambioPassword onListo={() => setPerfil(p => p && { ...p, cambiar_password: false })} />}
    </Ctx.Provider>
  )
}

function SoloAppTecnicos({ nombre, url }: { nombre: string; url: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f1f7f9] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
        <h1 className="text-xl font-extrabold text-[#102c43]">Hola, {nombre.split(' ')[0]}</h1>
        <p className="mt-2 text-sm text-slate-600">Tu usuario es de técnico. Tus trabajos, avances y evidencias están en la app <b>Mis trabajos</b>.</p>
        <a href={url} className="mt-5 block rounded-2xl bg-[#17657c] px-4 py-3 font-semibold text-white">Abrir mi app</a>
        <button className="mt-3 text-sm font-semibold text-slate-500" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    </div>
  )
}

/** Primer acceso: pregunta si desea cambiar la contraseña inicial */
function PreguntaCambioPassword({ onListo }: { onListo: () => void }) {
  const [cambiar, setCambiar] = useState(false)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)

  async function cerrar() {
    await supabase.rpc('password_revisado')
    onListo()
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (p1.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (p1 !== p2) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setGuardando(false)
    if (error) return setError(/same|different/i.test(error.message) ? 'La nueva contraseña debe ser distinta a la actual.' : /weak|short|least/i.test(error.message) ? 'La contraseña es muy débil; usa letras y números.' : error.message)
    setHecho(true)
    await supabase.rpc('password_revisado')
    setTimeout(onListo, 1500)
  }
  const entrada = 'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-[#2298af] focus:ring-2 focus:ring-[#2298af]/30'
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0b2133]/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        {hecho ? <p className="py-6 text-center font-semibold text-emerald-700">¡Listo! Tu contraseña se actualizó.</p>
          : !cambiar ? (<>
            <h2 className="text-lg font-extrabold text-[#102c43]">Bienvenido</h2>
            <p className="mt-2 text-sm text-slate-600">Entraste con la contraseña inicial que te dio el taller. ¿Deseas cambiarla por una propia?</p>
            <div className="mt-5 grid gap-2">
              <button className="rounded-2xl bg-[#17657c] px-4 py-3 font-semibold text-white" onClick={() => setCambiar(true)}>Sí, cambiar mi contraseña</button>
              <button className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-700" onClick={cerrar}>Ahora no</button>
            </div>
          </>) : (
            <form onSubmit={guardar} className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#102c43]">Nueva contraseña</h2>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <input className={entrada} type={ver ? 'text' : 'password'} autoComplete="new-password" placeholder="Nueva contraseña" value={p1} onChange={e => setP1(e.target.value)} autoFocus />
              <input className={entrada} type={ver ? 'text' : 'password'} autoComplete="new-password" placeholder="Repite la contraseña" value={p2} onChange={e => setP2(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Mostrar contraseña</label>
              <button className="w-full rounded-2xl bg-[#17657c] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar contraseña'}</button>
              <button type="button" className="w-full text-sm font-semibold text-slate-500" onClick={cerrar}>Mejor después</button>
            </form>
          )}
      </div>
    </div>
  )
}

export const useAuth = () => useContext(Ctx)
