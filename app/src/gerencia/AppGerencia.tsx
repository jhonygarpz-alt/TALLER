import { useState, type ReactNode } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Activity, BarChart3, LogOut, RefreshCw, Settings, Wallet, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import LoginMovil from '../movil/pantallas/Login'
import { PERIODOS, rango, useTablero, type Periodo, type Tablero } from './datos'
import { fechaCorta } from './graficas'
import Resumen from './pantallas/Resumen'
import Operacion from './pantallas/Operacion'
import Finanzas from './pantallas/Finanzas'
import Ajustes from './pantallas/Ajustes'

const BASE = import.meta.env.BASE_URL
const leerPeriodo = (): Periodo => { try { return (localStorage.getItem('gerencia.periodo') as Periodo) || 'hoy' } catch { return 'hoy' } }

export interface PropsPantalla { datos: Tablero; periodo: Periodo }

/** Tarjeta de indicador con brillo de color */
export function Kpi({ icono: Icono, valor, label, color, sub, grande }: { icono: LucideIcon; valor: ReactNode; label: string; color: string; sub?: ReactNode; grande?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[.07] bg-white/[.04] p-3.5">
      <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-30 blur-2xl" style={{ background: color }} />
      <div className="relative flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${color}22`, color, boxShadow: `0 0 14px ${color}44` }}><Icono className="h-[18px] w-[18px]" /></span>
        <span className="text-[11px] leading-tight font-semibold text-slate-400">{label}</span>
      </div>
      <div className={`relative mt-2 font-extrabold tracking-tight text-white ${grande ? 'text-[34px] leading-none' : 'text-2xl'}`}>{valor}</div>
      {sub && <div className="relative mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

function Encabezado({ periodo, setPeriodo, datos, cargando, recargar }: { periodo: Periodo; setPeriodo: (p: Periodo) => void; datos: Tablero | null; cargando: boolean; recargar: () => void }) {
  const { perfil } = useAuth()
  const r = rango(periodo)
  const hora = datos ? new Date(datos.actualizado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
  return (
    <header className="sticky top-0 z-30 border-b border-white/[.06] bg-[#050807]/85 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <img src={`${BASE}gerencia/icon-192.png`} alt="" className="h-11 w-11 rounded-2xl shadow-[0_0_18px_rgba(46,232,111,.35)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[.14em] text-emerald-300/80 uppercase">Gerencia · Taller Legaria</div>
          <div className="truncate text-lg font-extrabold text-white">Hola, {perfil?.nombre?.split(' ')[0] ?? ''}</div>
        </div>
        <button onClick={recargar} aria-label="Actualizar" className="flex flex-col items-center rounded-2xl px-2 py-1 text-slate-300 active:bg-white/10">
          <RefreshCw className={`h-5 w-5 ${cargando ? 'animate-spin text-emerald-300' : ''}`} />
          <span className="text-[10px] text-slate-500">{hora}</span>
        </button>
      </div>
      <div className="mt-3 flex gap-1.5 rounded-2xl bg-white/[.05] p-1">
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${periodo === p.id ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-[#04140b] shadow-[0_0_16px_rgba(46,232,111,.45)]' : 'text-slate-400 active:bg-white/10'}`}>{p.label}</button>
        ))}
      </div>
      <div className="mt-1.5 text-center text-[11px] text-slate-500">{r.desde === r.hasta ? fechaCorta(r.desde) : `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`}</div>
    </header>
  )
}

function BarraInferior({ finanzas }: { finanzas: boolean }) {
  const item = (to: string, Icono: LucideIcon, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition ${isActive ? 'bg-emerald-400/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(46,232,111,.35)]' : 'text-slate-500 active:bg-white/5'}`}>
      <Icono className="h-[22px] w-[22px]" />{label}
    </NavLink>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.06] bg-[#070b09]/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg gap-1.5">
        {item('/', BarChart3, 'Resumen')}
        {item('/operacion', Activity, 'Operación')}
        {finanzas && item('/finanzas', Wallet, 'Finanzas')}
        {item('/ajustes', Settings, 'Ajustes')}
      </div>
    </nav>
  )
}

function Bloqueo({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050807] p-8 text-center text-slate-300">
      <img src={`${BASE}gerencia/icon-192.png`} alt="" className="h-20 w-20 rounded-3xl" />
      {children}
      <button className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Cerrar sesión</button>
    </div>
  )
}

function Contenido() {
  const { puede } = useAuth()
  const [periodo, setP] = useState<Periodo>(leerPeriodo)
  const setPeriodo = (p: Periodo) => { setP(p); try { localStorage.setItem('gerencia.periodo', p) } catch { /* sin almacenamiento */ } }
  const { datos, error, cargando, recargar } = useTablero(periodo)
  const fin = puede('finanzas.ver')
  const cuerpo = (el: (d: Tablero) => ReactNode) => !datos
    ? (error ? <div className="m-4 rounded-2xl bg-red-500/15 p-4 text-sm text-red-200">{error}</div> : <Esqueleto />)
    : el(datos)
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#050807] bg-[radial-gradient(ellipse_at_top,rgba(46,232,111,.12),transparent_55%)] text-slate-200">
      <Encabezado periodo={periodo} setPeriodo={setPeriodo} datos={datos} cargando={cargando} recargar={recargar} />
      {error && datos && <div className="mx-4 mt-3 rounded-2xl bg-red-500/15 px-4 py-2 text-xs text-red-200">No se pudo actualizar: {error}</div>}
      <main className="space-y-4 px-4 pt-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
        <Routes>
          <Route path="/operacion" element={cuerpo(d => <Operacion datos={d} periodo={periodo} />)} />
          <Route path="/finanzas" element={cuerpo(d => fin ? <Finanzas datos={d} periodo={periodo} /> : null)} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={cuerpo(d => <Resumen datos={d} periodo={periodo} />)} />
        </Routes>
      </main>
      <BarraInferior finanzas={fin} />
    </div>
  )
}

function Esqueleto() {
  return <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white/[.05]" />)}</div>
}

export default function AppGerencia() {
  const { session, perfil, puede } = useAuth()
  if (!session) return <LoginMovil titulo="Gerencia" sub="Indicadores clave del taller en tiempo real" icono="gerencia/icon-192.png" soloIcono />
  if (!perfil?.activo) return <Bloqueo><p>Tu cuenta <b>{session.user.email}</b> aún no está activa. Pide a Dirección que la active.</p></Bloqueo>
  if (!puede('reportes.ver')) return <Bloqueo><p>Esta app es para <b>Dirección y Gerencia</b>. Tu usuario no tiene permiso para ver los reportes del taller.</p></Bloqueo>
  return <Contenido />
}
