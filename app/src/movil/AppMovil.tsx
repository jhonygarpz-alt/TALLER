import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CarFront, Home, Plus, UserRound, Wrench } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Cargando } from './ui'
import LoginMovil from './pantallas/Login'
import Inicio from './pantallas/Inicio'

const Ordenes = lazy(() => import('./pantallas/Ordenes'))
const Orden = lazy(() => import('./pantallas/Orden'))
const EvidenciaFotos = lazy(() => import('./pantallas/EvidenciaFotos'))
const NuevaOrden = lazy(() => import('./pantallas/NuevaOrden'))
const Trabajos = lazy(() => import('./pantallas/Trabajos'))
const Cuenta = lazy(() => import('./pantallas/Cuenta'))

/** Barra inferior tipo píldora + botón flotante para nueva orden */
function BarraInferior() {
  const { puede } = useAuth()
  const loc = useLocation()
  const item = (to: string, Icono: typeof Home, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition ${isActive ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-md shadow-brand-900/25' : 'text-slate-500 active:bg-slate-100'}`}>
      <Icono className="h-[22px] w-[22px]" />{label}
    </NavLink>
  )
  const conFab = puede('ordenes.gestionar') && (loc.pathname === '/' || loc.pathname === '/ordenes')
  return (
    <>
      {conFab && (
        <NavLink to="/nueva" aria-label="Nueva orden" className="fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 pr-5 pl-4 font-bold text-white shadow-xl shadow-brand-900/35 active:scale-95">
          <Plus className="h-6 w-6" strokeWidth={2.6} /> Nueva OT
        </NavLink>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-1.5">
          {item('/', Home, 'Inicio')}
          {item('/ordenes', CarFront, 'Órdenes')}
          {item('/trabajos', Wrench, 'Trabajos')}
          {item('/cuenta', UserRound, 'Mi perfil')}
        </div>
      </nav>
    </>
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
  const sinBarra = loc.pathname.startsWith('/nueva') || loc.pathname.endsWith('/evidencia')
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 text-slate-800">
      <div className={sinBarra ? '' : 'pb-[calc(92px+env(safe-area-inset-bottom))]'}>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/ordenes" element={<Ordenes />} />
            <Route path="/orden/:id" element={<Orden />} />
            <Route path="/orden/:id/evidencia" element={<EvidenciaFotos />} />
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
