import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ClipboardList, Home, Plus, UserRound, Wrench } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Cargando } from './ui'
import LoginMovil from './pantallas/Login'
import Inicio from './pantallas/Inicio'

const Ordenes = lazy(() => import('./pantallas/Ordenes'))
const Orden = lazy(() => import('./pantallas/Orden'))
const NuevaOrden = lazy(() => import('./pantallas/NuevaOrden'))
const Trabajos = lazy(() => import('./pantallas/Trabajos'))
const Cuenta = lazy(() => import('./pantallas/Cuenta'))

/** Barra inferior: los 5 destinos principales al alcance del pulgar */
function BarraInferior() {
  const { puede } = useAuth()
  const item = (to: string, Icono: typeof Home, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold transition ${isActive ? 'text-brand-700' : 'text-slate-400'}`}>
      {({ isActive }) => <><span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${isActive ? 'bg-brand-100' : ''}`}><Icono className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 2} /></span>{label}</>}
    </NavLink>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg items-end">
        {item('/', Home, 'Inicio')}
        {item('/ordenes', ClipboardList, 'Órdenes')}
        {puede('ordenes.gestionar') ? (
          <NavLink to="/nueva" className="flex flex-1 flex-col items-center pb-1 text-[11px] font-semibold text-brand-700" aria-label="Nueva orden">
            <span className="-mt-6 mb-0.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-800/40 ring-4 ring-white"><Plus className="h-7 w-7" strokeWidth={2.6} /></span>
            Nueva
          </NavLink>
        ) : null}
        {item('/trabajos', Wrench, 'Trabajos')}
        {item('/cuenta', UserRound, 'Cuenta')}
      </div>
    </nav>
  )
}

export default function AppMovil() {
  const { session, perfil } = useAuth()
  const loc = useLocation()
  if (!session) return <LoginMovil />
  if (!perfil?.activo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <div className="text-lg font-bold">Cuenta pendiente de activar</div>
        <p className="text-sm text-slate-600">Tu cuenta <b>{session.user.email}</b> existe, pero Dirección debe activarla y asignarte un rol desde Administración → Usuarios.</p>
        <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    )
  }
  const sinBarra = loc.pathname.startsWith('/nueva')
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 text-slate-800">
      <div className={sinBarra ? '' : 'pb-[calc(76px+env(safe-area-inset-bottom))]'}>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/ordenes" element={<Ordenes />} />
            <Route path="/orden/:id" element={<Orden />} />
            <Route path="/nueva" element={<NuevaOrden />} />
            <Route path="/trabajos" element={<Trabajos />} />
            <Route path="/cuenta" element={<Cuenta />} />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </Suspense>
      </div>
      {!sinBarra && <BarraInferior />}
    </div>
  )
}
