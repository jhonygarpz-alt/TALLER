import AyudaContextual, { BotonAyuda } from './AyudaContextual'
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Car, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardCheck, ClipboardList, LogOut, Menu, Plus,
  Search, Settings, Smartphone, Wrench, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAlertas, type Alertas } from '../lib/alertas'
import { ROLES } from '../lib/format'
import { useEmpresa } from '../lib/empresa'
import { GRUPOS_NAV, type ItemNav, type SubNav } from '../lib/navegacion'

/** Logotipo: usa el logo cargado por la empresa (Administración → Empresa y logo) o el ícono por defecto */
export function Logo({ compacto = false, claro = true }: { compacto?: boolean; claro?: boolean }) {
  const emp = useEmpresa()
  return (
    <div className="flex min-w-0 items-center gap-3">
      {emp.logoUrl ? (
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_6px_18px_-6px_rgba(0,0,0,.45)] ring-1 ring-white/30 ${compacto ? 'h-11 w-11' : 'h-14 w-14'}`}>
          <img src={emp.logoUrl} alt={emp.nombre} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2298af] to-[#17657c] shadow-lg">
          <Car className="h-6 w-6 text-white" />
          <Wrench className="absolute -top-1.5 -left-1.5 h-4 w-4 rotate-[-30deg] text-[#c5e6ed]" />
        </div>
      )}
      {!compacto && (
        <div className="min-w-0 leading-tight">
          <div className={`truncate text-[17px] font-extrabold tracking-[.04em] ${claro ? 'text-white' : 'text-[#193344]'}`}>ADMIN TALLER</div>
          <div className={`truncate text-xs ${claro ? 'text-[#c5e6ed]/75' : 'text-[#66818f]'}`}>{emp.nombre && emp.nombre !== 'Admin Taller' ? emp.nombre : 'Taller Legaria'}</div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- utilidades ---- */
function useFuera(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cerrar() }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [abierto, cerrar])
  return ref
}
function contar(a: Alertas, c?: SubNav['contador']) {
  if (!c) return 0
  const v = a[c]
  return Array.isArray(v) ? v.length : Number(v) || 0
}
/** ¿La ubicación actual corresponde a este enlace (ruta y parámetros)? */
function coincide(to: string, pathname: string, search: string) {
  const [ruta, qs] = to.split('?')
  if (ruta !== pathname) return false
  if (!qs) return !search || search === '?'
  const actual = new URLSearchParams(search)
  return [...new URLSearchParams(qs)].every(([k, v]) => actual.get(k) === v)
}

/* ---------------------------------------------------------------- Topbar: paneles ---- */
function PanelFlotante({ titulo, children, ancho = 'w-80' }: { titulo: string; children: ReactNode; ancho?: string }) {
  return (
    <div className={`absolute right-0 z-50 mt-2 ${ancho} overflow-hidden rounded-2xl border border-[#dbe9ee] bg-white text-[#193344] shadow-[0_24px_60px_-20px_rgba(16,44,67,.55)] animate-aparecer`}>
      <div className="border-b border-[#e8f1f4] bg-[#f4f9fb] px-4 py-2.5 text-[11px] font-bold tracking-[.12em] text-[#66818f] uppercase">{titulo}</div>
      <div className="p-1.5">{children}</div>
    </div>
  )
}
function FilaPanel({ n, t, to, c, cerrar }: { n: number; t: string; to: string; c: string; cerrar: () => void }) {
  return (
    <Link to={to} onClick={cerrar} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f1f8fa]">
      <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-sm font-bold ${c}`}>{n}</span>
      <span className="flex-1">{t}</span><ChevronRight className="h-4 w-4 text-[#a9c1ca]" />
    </Link>
  )
}
function BotonRedondo({ onClick, etiqueta, n, tono = 'bg-[#e0585a]', children }: { onClick: () => void; etiqueta: string; n?: number; tono?: string; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={etiqueta} title={etiqueta}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/[.08] text-[#c5e6ed] ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white">
      {children}
      {!!n && <span className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white ring-2 ring-[#102c43] ${tono}`}>{n > 99 ? '99+' : n}</span>}
    </button>
  )
}

/** Centro de notificaciones: alertas automáticas de riesgo en la operación */
function Notificaciones() {
  const a = useAlertas()
  const [open, setOpen] = useState(false)
  const ref = useFuera(open, () => setOpen(false))
  const items = [
    { n: a.retrasadas.length, t: 'Vehículos retrasados', to: '/ordenes?filtro=retrasados', c: 'bg-red-50 text-red-600' },
    { n: a.proximas.length, t: 'Próximos a vencer su entrega', to: '/ordenes?filtro=proximos', c: 'bg-amber-50 text-amber-600' },
    { n: a.detenidas.length, t: 'Detenidos por falta de material', to: '/ordenes?filtro=detenidos', c: 'bg-orange-50 text-orange-600' },
    { n: a.sinActualizar.length, t: 'Sin actualización de avance', to: '/ordenes?filtro=sin_actualizar', c: 'bg-slate-100 text-slate-600' },
  ].filter(i => i.n > 0)
  const total = items.reduce((s, i) => s + i.n, 0)
  return (
    <div className="relative" ref={ref}>
      <BotonRedondo onClick={() => setOpen(!open)} etiqueta="Notificaciones" n={total}><Bell className="h-[19px] w-[19px]" /></BotonRedondo>
      {open && (
        <PanelFlotante titulo="Notificaciones">
          {items.length === 0 ? <div className="px-3 py-6 text-center text-sm text-[#66818f]">Sin alertas por ahora. Todo en orden.</div>
            : items.map(i => <FilaPanel key={i.t} {...i} cerrar={() => setOpen(false)} />)}
        </PanelFlotante>
      )}
    </div>
  )
}

/** Tareas pendientes: acciones que esperan a alguien del equipo */
function Tareas() {
  const a = useAlertas()
  const { puede } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useFuera(open, () => setOpen(false))
  const items = [
    { n: a.listas.length, t: 'Vehículos listos por entregar', to: '/ordenes?filtro=etapa:listo_entrega', c: 'bg-emerald-50 text-emerald-700', ok: true },
    { n: a.sinContactar, t: 'Asignaciones sin contactar', to: '/ordenes?tab=asignaciones&estatus=sin_contactar', c: 'bg-sky-50 text-sky-700', ok: true },
    { n: a.comprasPorAutorizar, t: 'Compras por autorizar', to: '/compras?tab=compras&estado=por_autorizar', c: 'bg-amber-50 text-amber-700', ok: true },
    { n: a.solicitudesPorAutorizar, t: 'Solicitudes de material por autorizar', to: '/inventario?tab=solicitudes', c: 'bg-amber-50 text-amber-700', ok: puede('materiales.autorizar') },
    { n: a.solicitudesPorEntregar, t: 'Material por entregar', to: '/inventario?tab=solicitudes', c: 'bg-sky-50 text-sky-700', ok: puede('almacen.gestionar') },
  ].filter(i => i.ok && i.n > 0)
  const total = items.reduce((s, i) => s + i.n, 0)
  return (
    <div className="relative" ref={ref}>
      <BotonRedondo onClick={() => setOpen(!open)} etiqueta="Tareas pendientes" n={total} tono="bg-[#2298af]"><ClipboardCheck className="h-[19px] w-[19px]" /></BotonRedondo>
      {open && (
        <PanelFlotante titulo="Tareas pendientes">
          {items.length === 0 ? <div className="px-3 py-6 text-center text-sm text-[#66818f]">No hay tareas pendientes.</div>
            : items.map(i => <FilaPanel key={i.t} n={i.n} t={i.t} to={i.to} c={i.c} cerrar={() => setOpen(false)} />)}
        </PanelFlotante>
      )}
    </div>
  )
}

export function UserAvatar({ nombre, className = 'h-10 w-10 text-sm' }: { nombre?: string | null; className?: string }) {
  const ini = (nombre ?? '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4fc0d5] to-[#17657c] font-bold text-white ring-2 ring-white/20 ${className}`}>{ini}</span>
}

function MenuUsuario() {
  const { perfil, puede } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useFuera(open, () => setOpen(false))
  const fila = 'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f1f8fa]'
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left transition hover:bg-white/10" aria-label="Menú de perfil">
        <UserAvatar nombre={perfil?.nombre} />
        <span className="hidden leading-tight lg:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-white">{perfil?.nombre}</span>
          <span className="block text-xs text-[#c5e6ed]/70">{ROLES[perfil?.rol ?? '']}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-[#c5e6ed]/60 lg:block" />
      </button>
      {open && (
        <PanelFlotante titulo="Mi cuenta" ancho="w-64">
          {(puede('usuarios.gestionar') || puede('config.gestionar') || puede('auditoria.ver')) && (
            <Link to="/administracion" onClick={() => setOpen(false)} className={fila}><Settings className="h-4 w-4 text-[#66818f]" /> Configuración</Link>
          )}
          <a href={`${import.meta.env.BASE_URL}movil/`} target="_blank" rel="noreferrer" className={fila}><Smartphone className="h-4 w-4 text-[#66818f]" /> App móvil (instalar)</a>
          <a href={`${import.meta.env.BASE_URL}tecnicos/`} target="_blank" rel="noreferrer" className={fila}><Wrench className="h-4 w-4 text-[#66818f]" /> App de técnicos (instalar)</a>
          {puede('reportes.ver') && <a href={`${import.meta.env.BASE_URL}gerencia/`} target="_blank" rel="noreferrer" className={fila}><BarChart3 className="h-4 w-4 text-[#66818f]" /> App de gerencia (instalar)</a>}
          <div className="my-1 h-px bg-[#e8f1f4]" />
          <button onClick={() => supabase.auth.signOut()} className={`${fila} w-full text-red-600 hover:!bg-red-50`}><LogOut className="h-4 w-4" /> Cerrar sesión</button>
        </PanelFlotante>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Sidebar ---- */
const leerContraido = () => { try { return localStorage.getItem('menu-contraido') === '1' } catch { return false } }

function Contador({ n, activo }: { n: number; activo?: boolean }) {
  if (!n) return null
  return <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold ${activo ? 'bg-white text-[#17657c]' : 'bg-white/15 text-white'}`}>{n}</span>
}

function ElementoMenu({ item, chico, alertas }: { item: ItemNav; chico: boolean; alertas: Alertas }) {
  const { puede } = useAuth()
  const { pathname, search } = useLocation()
  const activo = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/')
  const hijos = (item.hijos ?? []).filter(h => !h.permiso || h.permiso.some(p => puede(p)))
  const [abierto, setAbierto] = useState(activo)
  useEffect(() => { if (activo) setAbierto(true) }, [activo])
  const n = contar(alertas, item.contador)
  const base = `group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200 ${chico ? 'justify-center' : ''}`
  const estilo = activo ? 'bg-[#2298af]/30 text-white ring-1 ring-[#4fc0d5]/40 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]' : 'text-[#d7edf2]/80 hover:bg-white/[.07] hover:text-white'
  return (
    <li>
      <div className="flex items-center gap-1">
        <Link to={item.to} title={chico ? item.label : undefined} className={`${base} ${estilo}`}>
          <item.icon className={`h-[18px] w-[18px] shrink-0 ${activo ? 'text-[#7fd6e6]' : 'text-[#9cc9d4] group-hover:text-white'}`} strokeWidth={1.8} />
          {!chico && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          {!chico && <Contador n={n} activo={activo} />}
          {chico && n > 0 && <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-[#ffb648]" />}
        </Link>
        {!chico && hijos.length > 0 && (
          <button onClick={() => setAbierto(!abierto)} aria-label={abierto ? `Contraer ${item.label}` : `Expandir ${item.label}`} aria-expanded={abierto}
            className="shrink-0 rounded-lg p-1.5 text-[#9cc9d4] transition hover:bg-white/10 hover:text-white">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`} />
          </button>
        )}
      </div>
      {!chico && hijos.length > 0 && (
        <div className={`grid transition-[grid-template-rows] duration-300 ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <ul className="ml-[22px] overflow-hidden border-l border-white/10 pl-2">
            {hijos.map(h => {
              const sel = coincide(h.to, pathname, search)
              const c = contar(alertas, h.contador)
              return (
                <li key={h.to}>
                  <Link to={h.to} className={`my-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition ${sel ? 'bg-white/10 font-semibold text-white' : 'text-[#c5e6ed]/70 hover:bg-white/[.06] hover:text-white'}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sel ? 'bg-[#7fd6e6]' : 'bg-white/25'}`} />
                    <span className="min-w-0 flex-1 truncate">{h.label}</span>
                    {c > 0 && <span className="rounded-full bg-white/12 px-1.5 text-[10px] font-bold text-white">{c}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}

function Sidebar({ chico, menu, cerrar, alternar, contraido }: { chico: boolean; menu: boolean; cerrar: () => void; alternar: () => void; contraido: boolean }) {
  const { puede } = useAuth()
  const alertas = useAlertas()
  const grupos = GRUPOS_NAV.map(g => ({ ...g, items: g.items.filter(i => !i.permiso || i.permiso.some(p => puede(p))) })).filter(g => g.items.length)
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden text-white shadow-2xl transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${menu ? 'translate-x-0' : '-translate-x-full'} ${contraido ? 'md:w-[84px]' : 'md:w-[268px]'}`}>
      <div className="erp-sidebar pointer-events-none absolute inset-0 md:inset-y-3 md:left-3 md:right-0 md:rounded-[26px] md:ring-1 md:ring-white/10" />
      <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#2298af]/25 blur-3xl" />
      <div className="relative flex h-full flex-col md:py-3 md:pl-3">
        <div className={`flex items-center justify-between py-5 ${chico ? 'justify-center px-2' : 'px-5'}`}>
          <Link to="/" aria-label="Panel de control"><Logo compacto={chico} /></Link>
          <button className="rounded-lg p-1 text-[#c5e6ed]/70 hover:bg-white/10 md:hidden" onClick={cerrar} aria-label="Cerrar menú"><X className="h-6 w-6" /></button>
        </div>
        <nav data-sin-ayuda className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:rgba(255,255,255,.2)_transparent]">
          {grupos.map(g => (
            <div key={g.titulo} className="mb-3">
              {!chico ? <div className="px-3 pt-2 pb-1.5 text-[10.5px] font-bold tracking-[.16em] text-[#9cc9d4]/60 uppercase">{g.titulo}</div> : <div className="mx-auto my-2 h-px w-8 bg-white/10" />}
              <ul className="space-y-0.5">{g.items.map(i => <ElementoMenu key={i.to} item={i} chico={chico} alertas={alertas} />)}</ul>
            </div>
          ))}
        </nav>
        <div className={`mx-3 mb-2 flex items-center gap-2 rounded-2xl bg-white/[.06] px-3 py-3 ring-1 ring-white/10 ${chico ? 'justify-center' : ''}`}>
          {!chico && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12px] font-semibold text-white">{alertas.activas.length} vehículos en taller</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#4fc0d5] to-[#2298af]" style={{ width: `${alertas.activas.length ? Math.max(6, 100 - (alertas.retrasadas.length / alertas.activas.length) * 100) : 0}%` }} /></div>
              <div className="mt-1 text-[10.5px] text-[#c5e6ed]/60">{alertas.activas.length ? `${alertas.activas.length - alertas.retrasadas.length} en tiempo · ${alertas.retrasadas.length} con retraso` : 'Sin vehículos en proceso'}</div>
            </div>
          )}
          <button onClick={alternar} className="hidden shrink-0 rounded-lg bg-white/10 p-1.5 text-[#e6f5f8] transition hover:bg-white/20 md:block"
            title={contraido ? 'Expandir menú' : 'Contraer menú'} aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}>
            {contraido ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  )
}

/* ---------------------------------------------------------------- Layout ---- */
export default function Layout() {
  const { puede } = useAuth()
  const [menu, setMenu] = useState(false)
  const [contraido, setContraido] = useState(leerContraido)
  const [q, setQ] = useState('')
  const busq = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(() => setMenu(false), [loc.pathname, loc.search])
  // Atajo de teclado: Ctrl/⌘ + K enfoca el buscador global
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); busq.current?.focus() } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  const alternar = () => setContraido(c => { try { localStorage.setItem('menu-contraido', c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  const chico = contraido && !menu   // en celular el menú siempre se muestra completo
  const mac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  function buscar(e: FormEvent) {
    e.preventDefault()
    if (q.trim()) nav(`/ordenes?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="erp-shell min-h-screen overflow-x-clip md:flex">
      {menu && <div className="fixed inset-0 z-30 bg-[#0b2133]/60 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)} />}
      <Sidebar chico={chico} menu={menu} cerrar={() => setMenu(false)} alternar={alternar} contraido={contraido} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 px-3 pt-3 md:px-4">
          <div className="flex items-center gap-2 rounded-[22px] bg-[#102c43]/85 px-3 py-2.5 shadow-[0_10px_30px_-14px_rgba(0,0,0,.6)] ring-1 ring-white/10 backdrop-blur-xl md:gap-3 md:px-4">
            <button className="rounded-full p-2 text-[#c5e6ed] hover:bg-white/10 md:hidden" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu className="h-6 w-6" /></button>
            <form onSubmit={buscar} className="relative max-w-xl flex-1">
              <Search className="absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-[#9cc9d4]" />
              <input ref={busq} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar orden, placa, siniestro, cliente…" aria-label="Buscador global"
                className="w-full rounded-full border border-white/10 bg-white/[.07] py-2.5 pr-14 pl-10 text-sm text-white placeholder:text-[#9cc9d4]/70 transition focus:border-[#4fc0d5]/60 focus:bg-white/[.12] focus:ring-2 focus:ring-[#2298af]/30 focus:outline-none" />
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-white/15 bg-white/[.06] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#c5e6ed]/70 sm:block">{mac ? '⌘' : 'Ctrl'} K</kbd>
            </form>
            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              <Link to="/ordenes" title="Órdenes de trabajo" aria-label="Órdenes de trabajo" className="hidden h-10 items-center gap-2 rounded-full bg-white/[.08] px-3.5 text-sm font-semibold text-[#e6f5f8] ring-1 ring-white/10 transition hover:bg-white/15 xl:flex">
                <ClipboardList className="h-4 w-4" /> Órdenes
              </Link>
              {puede('ordenes.gestionar') && (
                <Link to="/ordenes/nueva" title="Recibir un vehículo y crear su orden" className="hidden h-10 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#2bb0c8] to-[#1d8299] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(34,152,175,.9)] transition hover:brightness-110 sm:flex">
                  <Plus className="h-4 w-4" /> Nueva orden
                </Link>
              )}
              <BotonAyuda />
              <Tareas />
              <Notificaciones />
              <div className="mx-1 hidden h-8 w-px bg-white/10 md:block" />
              <MenuUsuario />
            </div>
          </div>
        </header>
        <div className="min-w-0 flex-1 p-3 md:p-4 md:pt-3">
          <main key={loc.pathname} className="erp-panel min-h-[calc(100vh-96px)] min-w-0 animate-aparecer rounded-[26px] p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,.6)] ring-1 ring-white/40 md:p-6 lg:p-7">
            <Suspense fallback={<Cargando />}><Outlet /></Suspense>
          </main>
        </div>
      </div>
      <AyudaContextual />
    </div>
  )
}

function Cargando() {
  return (
    <div className="space-y-4">
      <div className="esqueleto h-28 !rounded-[22px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto h-24 !rounded-[20px]" />)}</div>
      <div className="esqueleto h-64 !rounded-[22px]" />
    </div>
  )
}
