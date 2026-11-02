import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, Car, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, Coins, FileText, HardHat, LayoutDashboard, LogOut, Menu, Package, Search, Settings, ShoppingCart, Users, Wrench, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAlertas } from '../lib/alertas'
import { ROLES } from '../lib/format'
import { useEmpresa } from '../lib/empresa'

// Menú de 12 módulos. "permiso" oculta el módulo a quien no puede consultarlo (la base de datos también lo impide)
const NAV: { to: string; label: string; icon: LucideIcon; permiso?: string[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes y aseguradoras', icon: Users },
  { to: '/ordenes', label: 'Órdenes de trabajo', icon: ClipboardList },
  { to: '/procesos', label: 'Procesos del taller', icon: Wrench },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
  { to: '/mano-obra', label: 'Mano de obra y destajos', icon: HardHat },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/costos', label: 'Costos y rentabilidad', icon: Coins, permiso: ['finanzas.ver'] },
  { to: '/facturacion', label: 'Facturación y cobranza', icon: FileText, permiso: ['finanzas.ver'] },
  { to: '/reportes', label: 'Reportes y KPIs', icon: BarChart3, permiso: ['reportes.ver', 'finanzas.ver'] },
  { to: '/administracion', label: 'Administración', icon: Settings, permiso: ['usuarios.gestionar', 'config.gestionar', 'auditoria.ver'] },
]

/** Logotipo: usa el logo cargado por la empresa (Administración → Empresa y logo) o el ícono por defecto */
export function Logo({ compacto = false, claro = true }: { compacto?: boolean; claro?: boolean }) {
  const emp = useEmpresa()
  return (
    <div className="flex min-w-0 items-center gap-3">
      {emp.logoUrl ? (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-md">
          <img src={emp.logoUrl} alt={emp.nombre} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-900/40">
          <Car className="h-6 w-6 text-white" />
          <Wrench className="absolute -top-1.5 -left-1.5 h-4 w-4 rotate-[-30deg] text-brand-200" />
        </div>
      )}
      {!compacto && (
        <div className="min-w-0 leading-tight">
          <div className={`truncate text-xl font-extrabold tracking-tight ${claro ? 'text-white' : 'text-slate-900'}`}>Admin Taller</div>
          <div className={`truncate text-xs ${claro ? 'text-emerald-200/70' : 'text-slate-500'}`}>{emp.nombre && emp.nombre !== 'Admin Taller' ? emp.nombre : 'Control de Taller'}</div>
        </div>
      )}
    </div>
  )
}

function Campana() {
  const a = useAlertas()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [])
  const items = [
    { n: a.retrasadas.length, t: 'vehículos retrasados', to: '/ordenes?filtro=retrasados', c: 'text-red-600' },
    { n: a.proximas.length, t: 'próximos a vencer su entrega', to: '/ordenes?filtro=proximos', c: 'text-amber-600' },
    { n: a.detenidas.length, t: 'detenidos por falta de material', to: '/ordenes?filtro=detenidos', c: 'text-orange-600' },
    { n: a.sinActualizar.length, t: 'sin actualización de avance', to: '/ordenes?filtro=sin_actualizar', c: 'text-slate-700' },
    { n: a.listas.length, t: 'terminados pendientes de entrega', to: '/ordenes?filtro=etapa:listo_entrega', c: 'text-green-700' },
    { n: a.comprasPorAutorizar, t: 'compras por autorizar', to: '/compras?tab=compras&estado=por_autorizar', c: 'text-blue-700' },
    { n: a.sinContactar, t: 'asignaciones sin contactar', to: '/ordenes?tab=asignaciones&estatus=sin_contactar', c: 'text-purple-700' },
  ].filter(i => i.n > 0)
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Alertas">
        <Bell className="h-6 w-6" />
        {a.total > 0 && <span className="absolute top-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{a.total}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border bg-white p-2 shadow-xl">
          <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Alertas automáticas</div>
          {items.length === 0 ? <div className="px-2 py-4 text-sm text-slate-500">Sin alertas por ahora ✅</div> : items.map(i => (
            <Link key={i.t} to={i.to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
              <span className={`w-7 text-right font-bold ${i.c}`}>{i.n}</span><span className="flex-1 text-slate-700">{i.t}</span><ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuUsuario() {
  const { perfil, puede } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [])
  const ini = (perfil?.nombre ?? '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-xl py-1 pr-2 pl-1 hover:bg-slate-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-navy-700 to-navy-900 text-sm font-bold text-white ring-2 ring-brand-500/30">{ini}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-bold text-slate-900">{perfil?.nombre}</span>
          <span className="block text-xs text-slate-500">{ROLES[perfil?.rol ?? '']}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border bg-white p-1.5 shadow-xl">
          {(puede('usuarios.gestionar') || puede('config.gestionar') || puede('auditoria.ver')) && (
            <Link to="/administracion" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Settings className="h-4 w-4" /> Configuración</Link>
          )}
          <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
        </div>
      )}
    </div>
  )
}

const leerContraido = () => { try { return localStorage.getItem('menu-contraido') === '1' } catch { return false } }

export default function Layout() {
  const { puede } = useAuth()
  const [menu, setMenu] = useState(false)
  const [contraido, setContraido] = useState(leerContraido)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(() => setMenu(false), [loc.pathname])
  const alternar = () => setContraido(c => { try { localStorage.setItem('menu-contraido', c ? '0' : '1') } catch { /* sin almacenamiento */ } return !c })
  const chico = contraido && !menu   // en celular el menú siempre se muestra completo

  function buscar(e: FormEvent) {
    e.preventDefault()
    if (q.trim()) nav(`/ordenes?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="min-h-screen md:flex">
      {menu && <div className="fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden text-white shadow-2xl transition-all duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${menu ? 'translate-x-0' : '-translate-x-full'} ${contraido ? 'md:w-[78px]' : 'md:w-64'}`}>
        {/* Fondo: degradado esmeralda con el auto y un destello diagonal */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-800 via-navy-900 to-navy-950" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
        <img src={`${import.meta.env.BASE_URL}img/menu-auto.webp`} alt="" aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[46%] w-full object-cover object-[20%_center] opacity-70 [mask-image:linear-gradient(to_top,black_35%,transparent)]" />

        <div className={`relative flex items-center justify-between py-5 ${chico ? 'justify-center px-3' : 'px-5'}`}>
          <Logo compacto={chico} />
          <button className="rounded-lg p-1 text-emerald-100/70 hover:bg-white/10 md:hidden" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X className="h-6 w-6" /></button>
        </div>
        <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.filter(n => !n.permiso || n.permiso.some(p => puede(p))).map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} title={chico ? n.label : undefined}
              className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${chico ? 'justify-center' : ''} ${isActive
                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-900/40'
                : 'text-emerald-50/80 hover:bg-white/10 hover:text-white'}`}>
              <n.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!chico && <span className="flex-1 truncate leading-tight">{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={`relative flex items-center gap-2 px-4 py-4 ${chico ? 'justify-center' : 'justify-between'}`}>
          {!chico && <span className="text-[11px] text-emerald-100/50">Admin Taller · v0.3</span>}
          <button onClick={alternar} className="hidden rounded-lg bg-white/10 p-1.5 text-emerald-50 backdrop-blur transition hover:bg-white/20 md:block"
            title={contraido ? 'Expandir menú' : 'Contraer menú'} aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}>
            {contraido ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-md md:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMenu(true)} aria-label="Menú"><Menu className="h-6 w-6" /></button>
          <form onSubmit={buscar} className="relative max-w-2xl flex-1">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar vehículo, OT, siniestro, cliente o placa…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-10 text-sm transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-1 md:gap-3">
            <Campana />
            <div className="hidden h-8 w-px bg-slate-200 md:block" />
            <MenuUsuario />
          </div>
        </header>
        <main key={loc.pathname} className="min-w-0 flex-1 animate-aparecer p-4 md:p-6 lg:p-8">
          <Suspense fallback={<Cargando />}><Outlet /></Suspense>
        </main>
      </div>
    </div>
  )
}

function Cargando() {
  return (
    <div className="space-y-4">
      <div className="esqueleto h-28" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto h-20" />)}</div>
      <div className="esqueleto h-64" />
    </div>
  )
}
