import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ClipboardList, Layers, RefreshCw, Search, Shield, Truck, User, X, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEmpresa } from '../../lib/empresa'
import { fecha, hoyISO, limpiaBusqueda } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Miniatura } from '../../components/Fotos'
import { BadgeEtapa, Cargando, Vacio } from '../ui'

const PROCESO = ['en_reparacion', 'hojalateria', 'preparacion', 'pintura', 'detallado', 'control_calidad']
const FILTROS: { id: string; label: string; icono: LucideIcon }[] = [
  { id: 'activas', label: 'Activas', icono: ClipboardList },
  { id: 'proceso', label: 'En proceso', icono: Layers },
  { id: 'retrasadas', label: 'Retrasadas', icono: AlertTriangle },
  { id: 'listas', label: 'Listas', icono: CheckCircle2 },
  { id: 'entregadas', label: 'Entregadas', icono: Truck },
]

export default function Ordenes() {
  const emp = useEmpresa()
  const [sp, setSp] = useSearchParams()
  const filtro = sp.get('filtro') ?? 'activas'
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [rows, setRows] = useState<VOrden[] | null>(null)
  const [conteo, setConteo] = useState<Record<string, number>>({})
  const [recarga, setRecarga] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (sp.get('buscar')) input.current?.focus() }, [sp])

  // Contadores de los filtros (como en "Activas (12)")
  useEffect(() => {
    const c = (f: (x: ReturnType<typeof base>) => ReturnType<typeof base>) => f(base()).then(({ count }) => count ?? 0)
    const base = () => supabase.from('v_ordenes').select('id', { count: 'exact', head: true })
    Promise.all([
      c(x => x.not('etapa', 'in', '(entregado,cancelado)')),
      c(x => x.in('etapa', PROCESO)),
      c(x => x.not('etapa', 'in', '(entregado,cancelado)').lt('fecha_compromiso', hoyISO())),
      c(x => x.eq('etapa', 'listo_entrega')),
    ]).then(([activas, proceso, retrasadas, listas]) => setConteo({ activas, proceso, retrasadas, listas }))
  }, [recarga])

  useEffect(() => {
    setRows(null)
    const t = setTimeout(() => {
      let query = supabase.from('v_ordenes').select('*').order('fecha_ingreso', { ascending: false }).limit(150)
      const s = limpiaBusqueda(q)
      if (s) query = query.or(['folio', 'os_bitacora', 'placas', 'siniestro', 'cliente_nombre', 'marca', 'modelo'].map(c => `${c}.ilike.%${s}%`).join(','))
      else if (filtro === 'activas') query = query.not('etapa', 'in', '(entregado,cancelado)')
      else if (filtro === 'retrasadas') query = query.not('etapa', 'in', '(entregado,cancelado)').lt('fecha_compromiso', hoyISO())
      else if (filtro === 'proceso') query = query.in('etapa', PROCESO)
      else if (filtro === 'listas') query = query.eq('etapa', 'listo_entrega')
      else if (filtro === 'entregadas') query = query.eq('etapa', 'entregado').order('fecha_entrega', { ascending: false })
      query.then(({ data }) => setRows((data ?? []) as VOrden[]))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, filtro, recarga])

  const hoy = hoyISO()
  const elegir = (id: string) => { const n = new URLSearchParams(); n.set('filtro', id); setSp(n, { replace: true }) }
  return (
    <div>
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 pt-[env(safe-area-inset-top)] pb-7 text-white">
        <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-36 w-[62%] object-cover object-[72%_55%] opacity-90 [mask-image:linear-gradient(to_left,black_45%,transparent)]" />
        <div className="relative flex h-14 items-center justify-between px-4">
          <button onClick={() => setRecarga(r => r + 1)} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Actualizar"><RefreshCw className="h-5 w-5" /></button>
          {emp.logoUrl ? <img src={emp.logoUrl} alt={emp.nombre} className="h-9 rounded-lg bg-white object-contain px-1" /> : <span className="font-bold">{emp.nombre}</span>}
          <button onClick={() => elegir('retrasadas')} className="relative -mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Órdenes retrasadas">
            <Bell className="h-6 w-6" />{!!conteo.retrasadas && <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold ring-2 ring-navy-900">{conteo.retrasadas}</span>}
          </button>
        </div>
        <div className="relative mt-3 px-5">
          <h1 className="text-[26px] leading-tight font-extrabold">Órdenes de trabajo</h1>
          <p className="max-w-[60%] text-sm text-emerald-100/80">Gestiona y da seguimiento a las OT del taller</p>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mt-4 space-y-3 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-50/90 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-2 backdrop-blur">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar OT, vehículo, placas o cliente…" enterKeyHint="search"
            className="block w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-11 pl-12 text-[15px] shadow-md shadow-slate-900/5 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
          {q && <button onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-slate-400" aria-label="Borrar búsqueda"><X className="h-5 w-5" /></button>}
        </div>
        {!q && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {FILTROS.map(f => {
              const activo = filtro === f.id
              return (
                <button key={f.id} onClick={() => elegir(f.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${activo ? 'bg-brand-700 text-white shadow-md shadow-brand-900/20' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
                  <f.icono className="h-4 w-4" />{f.label}{conteo[f.id] != null && <span className={activo ? 'text-emerald-100' : 'text-slate-400'}>({conteo[f.id]})</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-1">
        {!rows ? <Cargando /> : rows.length === 0 ? <Vacio icono={ClipboardList}>{q ? 'Ninguna orden coincide con la búsqueda' : 'No hay órdenes en este filtro'}</Vacio> : rows.map(o => {
          const retraso = o.etapa !== 'entregado' && o.etapa !== 'cancelado' && o.fecha_compromiso && o.fecha_compromiso < hoy
          return (
            <Link key={o.id} to={`/orden/${o.id}`} className="block rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80 active:bg-slate-50">
              <div className="flex gap-3">
                <Miniatura auto={o} path={o.foto_portada} className="h-[76px] w-[104px] rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="shrink-0 text-[17px] leading-tight font-extrabold whitespace-nowrap text-slate-900">{o.folio}</span>
                    <span className="min-w-0 overflow-hidden [&>span]:max-w-full [&>span]:truncate"><BadgeEtapa etapa={o.etapa} /></span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-700">{o.marca} {o.modelo} {o.anio ?? ''}</div>
                  <div className="truncate text-[13px] text-slate-500">Placas: <span className="font-semibold text-brand-700">{o.placas ?? '—'}</span>{o.os_bitacora && <span className="text-slate-400"> · OS {o.os_bitacora}</span>}</div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                <span className="flex min-w-0 items-center gap-1.5"><Shield className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate font-semibold">{o.tipo === 'aseguradora' ? o.aseguradora_nombre : 'PARTICULAR'}</span></span>
                <span className={`flex items-center gap-1.5 ${retraso ? 'font-bold text-red-600' : ''}`}><CalendarDays className={`h-3.5 w-3.5 shrink-0 ${retraso ? '' : 'text-slate-400'}`} />Entrega: {fecha(o.fecha_entrega ?? o.fecha_compromiso)}</span>
                <span className="col-span-2 flex min-w-0 items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{o.cliente_nombre}</span></span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
