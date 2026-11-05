import { useState, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, CarFront, ClipboardList, House, LayoutGrid, LogOut, RefreshCw, UserRound, BarChart3, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import LoginMovil from '../movil/pantallas/Login'
import { usePush } from '../tecnicos/push'
import { PERIODOS, useTablero, type Periodo, type Tablero } from './datos'
import { fechaLarga } from './graficas'
import Resumen from './pantallas/Resumen'
import Ordenes from './pantallas/Ordenes'
import Taller from './pantallas/Taller'
import Reportes from './pantallas/Reportes'
import Ajustes from './pantallas/Ajustes'

const BASE = import.meta.env.BASE_URL
const leerPeriodo = (): Periodo => { try { return (localStorage.getItem('gerencia.periodo') as Periodo) || 'hoy' } catch { return 'hoy' } }

export interface PropsPantalla { datos: Tablero; periodo: Periodo }

/** Tarjeta de indicador: ícono en mosaico, etiqueta y valor */
export function Kpi({ icono: Icono, valor, label, derecha, abajo }: { icono: LucideIcon; valor: ReactNode; label: string; derecha?: ReactNode; abajo?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-black/[.035] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,20,.04),0_6px_18px_rgba(16,24,20,.05)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f1f4f2] text-[#155c35]"><Icono className="h-[22px] w-[22px]" strokeWidth={1.7} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] leading-tight text-[#16211b]">{label}</div>
        <div className="mt-0.5 flex items-end justify-between gap-1">
          <span className="text-[26px] leading-[1.1] font-bold tracking-tight text-[#16211b]">{valor}</span>
          {(derecha || abajo) && <span className="flex flex-col items-end pb-0.5">{derecha}{abajo}</span>}
        </div>
      </div>
    </div>
  )
}

/** Marca: ícono TL + TALLER LEGARIA */
function Marca() {
  return (
    <div className="flex items-center gap-2">
      <img src={`${BASE}gerencia/icon-192.png`} alt="" className="h-9 w-9 rounded-xl" />
      <div className="leading-none italic">
        <div className="text-[11px] font-extrabold tracking-wide text-[#16211b]">TALLER</div>
        <div className="text-[18px] font-black tracking-tight text-[#155c35]">LEGARIA</div>
      </div>
    </div>
  )
}

function Encabezado() {
  const { estado } = usePush('gerencia')
  const { perfil } = useAuth()
  return (
    <header className="flex items-center gap-2.5 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3">
      <Marca />
      <span className="h-9 w-px shrink-0 bg-[#16211b]/20" />
      <div className="min-w-0 flex-1 leading-tight whitespace-nowrap">
        <div className="text-[15px] font-bold text-[#16211b]">Gerencia</div>
        <div className="text-[11.5px] text-[#16211b]">Panel Ejecutivo</div>
      </div>
      <Link to="/mas" aria-label="Notificaciones" className="relative rounded-full p-2 text-[#16211b] active:bg-black/5">
        <Bell className="h-6 w-6" strokeWidth={1.7} />
        {estado === 'activo' && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#3c9f62] ring-2 ring-[#f1f2f0]" />}
      </Link>
      <Link to="/mas" aria-label="Mi cuenta" className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-[#1f7a45] to-[#155c35] text-white shadow-[0_4px_12px_rgba(21,92,53,.35)]">
        {perfil?.nombre ? <span className="text-sm font-bold">{perfil.nombre.split(' ').map(p => p[0]).slice(0, 2).join('')}</span> : <UserRound className="h-5 w-5" />}
      </Link>
    </header>
  )
}

/** Saludo con la fecha (toca para actualizar) y el auto de fondo */
function Portada({ datos, cargando, recargar }: { datos: Tablero | null; cargando: boolean; recargar: () => void }) {
  const { perfil } = useAuth()
  const hora = datos ? new Date(datos.actualizado).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div className="relative overflow-hidden px-5 pt-1 pb-4">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[50%]" style={{ clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 0 100%)' }}>
        <img src={`${BASE}img/banner-taller.webp`} alt="" className="h-full w-full object-cover object-[72%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f1f2f0] via-[#f1f2f0]/30 to-transparent" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-[34%] w-12 -skew-x-[28deg] bg-gradient-to-b from-[#1f7a45] to-[#8ccf55]/20 opacity-80" />
      <div className="pointer-events-none absolute inset-y-0 right-[29%] w-4 -skew-x-[28deg] bg-[#155c35]/10" />
      <div className="relative">
        <h1 className="text-[30px] leading-tight font-bold tracking-[-.02em] text-[#16211b]">Hola, {perfil?.nombre?.split(' ')[0] ?? 'Gerencia'}</h1>
        <p className="text-[15px] text-[#66736c]">Resumen operativo del taller</p>
        <button onClick={recargar} className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/[.06] bg-white/95 px-4 py-2 text-[14px] text-[#16211b] shadow-[0_2px_10px_rgba(16,24,20,.08)] active:scale-[.98]">
          <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.7} />
          {datos ? fechaLarga(datos.hoy) : '…'}
          <RefreshCw className={`h-4 w-4 text-[#66736c] ${cargando ? 'animate-spin' : ''}`} />
        </button>
        {hora && <div className="mt-1.5 pl-1 text-[11px] text-[#66736c]">Actualizado {hora}</div>}
      </div>
    </div>
  )
}

function Periodos({ periodo, setPeriodo }: { periodo: Periodo; setPeriodo: (p: Periodo) => void }) {
  return (
    <div className="grid grid-cols-[.8fr_1fr_1.12fr_1.38fr] gap-1.5 px-4 pb-1">
      {PERIODOS.map(p => (
        <button key={p.id} onClick={() => setPeriodo(p.id)}
          className={`flex items-center justify-center gap-1 rounded-full px-1 py-2.5 text-[13px] whitespace-nowrap transition ${periodo === p.id ? 'bg-gradient-to-b from-[#1f7a45] to-[#155c35] font-semibold text-white shadow-[0_4px_12px_rgba(21,92,53,.3)]' : 'border border-black/[.04] bg-white text-[#16211b] shadow-[0_1px_2px_rgba(16,24,20,.05)]'}`}>
          <CalendarDays className="h-[15px] w-[15px] shrink-0" strokeWidth={1.7} />{p.label}
        </button>
      ))}
    </div>
  )
}

function BarraInferior() {
  const item = (to: string, Icono: LucideIcon, label: string) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[12px] transition ${isActive ? 'bg-gradient-to-b from-[#1f7a45] to-[#155c35] font-semibold text-white shadow-[0_4px_14px_rgba(21,92,53,.35)]' : 'text-[#16211b] active:bg-black/5'}`}>
      <Icono className="h-6 w-6" strokeWidth={1.6} />{label}
    </NavLink>
  )
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <div className="mx-auto flex max-w-lg gap-1 rounded-[26px] border border-black/[.04] bg-white/95 p-1.5 shadow-[0_-2px_20px_rgba(16,24,20,.08)] backdrop-blur">
        {item('/', House, 'Resumen')}
        {item('/ordenes', ClipboardList, 'Órdenes')}
        {item('/taller', CarFront, 'Taller')}
        {item('/reportes', BarChart3, 'Reportes')}
        {item('/mas', LayoutGrid, 'Más')}
      </div>
    </nav>
  )
}

function Bloqueo({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f1f2f0] p-8 text-center text-[#16211b]">
      <img src={`${BASE}gerencia/icon-192.png`} alt="" className="h-20 w-20 rounded-3xl" />
      {children}
      <button className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold shadow" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Cerrar sesión</button>
    </div>
  )
}

const TITULOS: Record<string, [string, string]> = {
  '/ordenes': ['Órdenes de trabajo', 'Lo que requiere atención y los últimos ingresos'],
  '/taller': ['Taller', 'Unidades por etapa y productividad'],
  '/reportes': ['Reportes', 'Cumplimiento, clientes y rentabilidad'],
  '/mas': ['Más', 'Notificaciones y cuenta'],
}

function Contenido() {
  const { pathname } = useLocation()
  const [periodo, setP] = useState<Periodo>(leerPeriodo)
  const setPeriodo = (p: Periodo) => { setP(p); try { localStorage.setItem('gerencia.periodo', p) } catch { /* sin almacenamiento */ } }
  const { datos, error, cargando, recargar } = useTablero(periodo)
  const titulo = TITULOS[pathname]
  const cuerpo = (el: (d: Tablero) => ReactNode) => !datos
    ? (error ? <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">{error}</div> : <Esqueleto />)
    : el(datos)
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#f1f2f0] text-[#16211b]" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
      <Encabezado />
      {titulo
        ? <div className="px-5 pt-1 pb-3"><h1 className="text-[26px] font-bold tracking-[-.02em]">{titulo[0]}</h1><p className="text-[14px] text-[#66736c]">{titulo[1]}</p></div>
        : <Portada datos={datos} cargando={cargando} recargar={recargar} />}
      {pathname !== '/mas' && <Periodos periodo={periodo} setPeriodo={setPeriodo} />}
      {error && datos && <div className="mx-4 mt-3 rounded-2xl bg-red-50 px-4 py-2 text-xs text-red-700">No se pudo actualizar: {error}</div>}
      <main className="space-y-3.5 px-4 pt-3.5 pb-[calc(110px+env(safe-area-inset-bottom))]">
        <Routes>
          <Route path="/ordenes" element={cuerpo(d => <Ordenes datos={d} periodo={periodo} />)} />
          <Route path="/taller" element={cuerpo(d => <Taller datos={d} periodo={periodo} />)} />
          <Route path="/reportes" element={cuerpo(d => <Reportes datos={d} periodo={periodo} />)} />
          <Route path="/mas" element={<Ajustes />} />
          <Route path="*" element={cuerpo(d => <Resumen datos={d} periodo={periodo} />)} />
        </Routes>
      </main>
      <BarraInferior />
    </div>
  )
}

function Esqueleto() {
  return <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-[22px] bg-white/70" />)}</div>
}

export default function AppGerencia() {
  const { session, perfil, puede } = useAuth()
  if (!session) return <LoginMovil titulo="Gerencia" sub="Panel ejecutivo del taller" icono="gerencia/icon-192.png" soloIcono />
  if (!perfil?.activo) return <Bloqueo><p>Tu cuenta <b>{session.user.email}</b> aún no está activa. Pide a Dirección que la active.</p></Bloqueo>
  if (!puede('reportes.ver')) return <Bloqueo><p>Esta app es para <b>Dirección y Gerencia</b>. Tu usuario no tiene permiso para ver los reportes del taller.</p></Bloqueo>
  return <Contenido />
}
