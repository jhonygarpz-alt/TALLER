import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Car, ChevronDown, ChevronRight, Home, LogOut, Menu, Search, Settings, ShoppingCart, BarChart3, Wrench, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAlertas } from '../lib/alertas'
import { ROLES } from '../lib/format'

const NAV = [
  { to: '/', label: 'Inicio', sub: '', icon: Home },
  { to: '/vehiculos', label: 'Vehículos', sub: 'Expedientes', icon: Car },
  { to: '/taller', label: 'Taller', sub: 'Producción', icon: Wrench },
  { to: '/compras', label: 'Compras', sub: 'Inventario', icon: ShoppingCart },
  { to: '/resultados', label: 'Resultados', sub: 'Reportes', icon: BarChart3 },
]

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
        <Car className="h-6 w-6 text-blue-400" />
        <Wrench className="absolute -top-1 -left-1 h-4 w-4 rotate-[-30deg] text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-xl font-extrabold tracking-tight text-white">TallerPro</div>
        <div className="text-xs text-slate-400">Control de Taller</div>
      </div>
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
    { n: a.retrasadas.length, t: 'vehículos retrasados', to: '/vehiculos?filtro=retrasados', c: 'text-red-600' },
    { n: a.proximas.length, t: 'próximos a vencer su entrega', to: '/vehiculos?filtro=proximos', c: 'text-amber-600' },
    { n: a.detenidas.length, t: 'detenidos por falta de material', to: '/vehiculos?filtro=detenidos', c: 'text-orange-600' },
    { n: a.sinActualizar.length, t: 'sin actualización de avance', to: '/vehiculos?filtro=sin_actualizar', c: 'text-slate-700' },
    { n: a.listas.length, t: 'terminados pendientes de entrega', to: '/vehiculos?filtro=etapa:listo_entrega', c: 'text-green-700' },
    { n: a.comprasPorAutorizar, t: 'compras por autorizar', to: '/compras?tab=compras&estado=por_autorizar', c: 'text-blue-700' },
    { n: a.sinContactar, t: 'asignaciones sin contactar', to: '/vehiculos?tab=asignaciones&estatus=sin_contactar', c: 'text-purple-700' },
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
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">{ini}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-bold text-slate-900">{perfil?.nombre}</span>
          <span className="block text-xs text-slate-500">{ROLES[perfil?.rol ?? '']}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border bg-white p-1.5 shadow-xl">
          {(puede('usuarios.gestionar') || puede('config.gestionar') || puede('auditoria.ver')) && (
            <Link to="/configuracion" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><Settings className="h-4 w-4" /> Configuración</Link>
          )}
          <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(() => setMenu(false), [loc.pathname])

  function buscar(e: FormEvent) {
    e.preventDefault()
    if (q.trim()) nav(`/vehiculos?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="min-h-screen md:flex">
      {menu && <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={() => setMenu(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-800 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-6">
          <Logo />
          <button className="text-slate-400 md:hidden" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X className="h-6 w-6" /></button>
        </div>
        <nav className="flex-1 space-y-1.5 px-3">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              className={({ isActive }) => `group flex items-center gap-4 rounded-xl px-4 py-3 transition ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-300 hover:bg-navy-700 hover:text-white'}`}>
              {({ isActive }) => (<>
                <n.icon className="h-6 w-6 shrink-0" />
                <span className="flex-1 leading-tight">
                  <span className="block text-[15px] font-semibold">{n.label}</span>
                  {n.sub && <span className={`block text-xs ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{n.sub}</span>}
                </span>
                {n.sub && <ChevronRight className="h-4 w-4 opacity-50" />}
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 text-[11px] text-slate-500">TallerPro · v0.1</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMenu(true)} aria-label="Menú"><Menu className="h-6 w-6" /></button>
          <form onSubmit={buscar} className="relative max-w-2xl flex-1">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar vehículo, siniestro, cliente o placa…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-10 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-1 md:gap-3">
            <Campana />
            <div className="hidden h-8 w-px bg-slate-200 md:block" />
            <MenuUsuario />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8"><Suspense fallback={<div className="p-10 text-center text-slate-400">Cargando…</div>}><Outlet /></Suspense></main>
      </div>
    </div>
  )
}
