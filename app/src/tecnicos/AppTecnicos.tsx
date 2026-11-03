import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { ClipboardList, UserRound, Wallet } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Cargando } from '../movil/ui'
import LoginMovil from '../movil/pantallas/Login'
import MisTrabajos from './pantallas/MisTrabajos'

const Trabajo = lazy(() => import('./pantallas/Trabajo'))
const Destajos = lazy(() => import('./pantallas/Destajos'))
const Perfil = lazy(() => import('./pantallas/Perfil'))

function BarraInferior() {
  const item = (to: string, Icono: typeof Wallet, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition ${isActive ? 'bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-md shadow-brand-900/25' : 'text-slate-500 active:bg-slate-100'}`}>
      <Icono className="h-[22px] w-[22px]" />{label}
    </NavLink>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] backdrop-blur">
      <div className="mx-auto flex max-w-lg gap-1.5">
        {item('/', ClipboardList, 'Mis trabajos')}
        {item('/destajos', Wallet, 'Destajos')}
        {item('/perfil', UserRound, 'Mi perfil')}
      </div>
    </nav>
  )
}

export default function AppTecnicos() {
  const { session, perfil } = useAuth()
  if (!session) return <LoginMovil titulo="Mis trabajos" sub="Hojalatería y pintura · avance desde tu celular" icono="tecnicos/icon-192.png" />
  if (!perfil?.activo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <div className="text-lg font-bold">Cuenta pendiente de activar</div>
        <p className="text-sm text-slate-600">Tu cuenta <b>{session.user.email}</b> existe, pero Dirección debe activarla y ligarla a tu ficha de técnico.</p>
        <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    )
  }
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-slate-50 text-slate-800">
      <div className="pb-[calc(92px+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route path="/" element={<MisTrabajos />} />
            <Route path="/trabajo/:id" element={<Trabajo />} />
            <Route path="/destajos" element={<Destajos />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="*" element={<MisTrabajos />} />
          </Routes>
        </Suspense>
      </div>
      <BarraInferior />
    </div>
  )
}
