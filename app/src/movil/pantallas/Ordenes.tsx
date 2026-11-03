import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ClipboardList, RefreshCw, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { hoyISO, limpiaBusqueda } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Miniatura } from '../../components/Fotos'
import { Barra, BadgeEtapa, Cargando, Vacio } from '../ui'

const FILTROS: { id: string; label: string }[] = [
  { id: 'activas', label: 'En taller' },
  { id: 'retrasadas', label: 'Retrasadas' },
  { id: 'recepcion', label: 'Recepción' },
  { id: 'proceso', label: 'En proceso' },
  { id: 'listas', label: 'Listas' },
  { id: 'entregadas', label: 'Entregadas' },
  { id: 'todas', label: 'Todas' },
]

export default function Ordenes() {
  const [sp, setSp] = useSearchParams()
  const filtro = sp.get('filtro') ?? 'activas'
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [rows, setRows] = useState<VOrden[] | null>(null)
  const [recarga, setRecarga] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (sp.get('buscar')) input.current?.focus() }, [sp])

  useEffect(() => {
    setRows(null)
    const t = setTimeout(() => {
      let query = supabase.from('v_ordenes').select('*').order('fecha_ingreso', { ascending: false }).limit(150)
      const s = limpiaBusqueda(q)
      if (s) query = query.or(['folio', 'os_bitacora', 'placas', 'siniestro', 'cliente_nombre', 'marca', 'modelo'].map(c => `${c}.ilike.%${s}%`).join(','))
      else if (filtro === 'activas') query = query.not('etapa', 'in', '(entregado,cancelado)')
      else if (filtro === 'retrasadas') query = query.not('etapa', 'in', '(entregado,cancelado)').lt('fecha_compromiso', hoyISO())
      else if (filtro === 'recepcion') query = query.in('etapa', ['recepcion', 'diagnostico', 'esperando_autorizacion'])
      else if (filtro === 'proceso') query = query.in('etapa', ['en_reparacion', 'hojalateria', 'preparacion', 'pintura', 'detallado', 'control_calidad'])
      else if (filtro === 'listas') query = query.eq('etapa', 'listo_entrega')
      else if (filtro === 'entregadas') query = query.eq('etapa', 'entregado').order('fecha_entrega', { ascending: false })
      query.then(({ data }) => setRows((data ?? []) as VOrden[]))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, filtro, recarga])

  const hoy = hoyISO()
  return (
    <div>
      <Barra titulo="Órdenes de trabajo" sub={rows ? `${rows.length} ${rows.length === 1 ? 'orden' : 'órdenes'}` : 'Cargando…'}
        accion={<button onClick={() => setRecarga(r => r + 1)} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Actualizar"><RefreshCw className="h-5 w-5" /></button>} />
      <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-20 space-y-3 bg-slate-50/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Placas, folio, OS, cliente…" enterKeyHint="search"
            className="block w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-11 pl-12 text-base shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
          {q && <button onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-slate-400" aria-label="Borrar búsqueda"><X className="h-5 w-5" /></button>}
        </div>
        {!q && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {FILTROS.map(f => (
              <button key={f.id} onClick={() => { const n = new URLSearchParams(); n.set('filtro', f.id); setSp(n, { replace: true }) }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${filtro === f.id ? 'bg-brand-700 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{f.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2.5 px-4 pt-1">
        {!rows ? <Cargando /> : rows.length === 0 ? <Vacio icono={ClipboardList}>{q ? 'Ninguna orden coincide con la búsqueda' : 'No hay órdenes en este filtro'}</Vacio> : rows.map(o => {
          const retraso = o.etapa !== 'entregado' && o.etapa !== 'cancelado' && o.fecha_compromiso && o.fecha_compromiso < hoy
          return (
            <Link key={o.id} to={`/orden/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/80 active:bg-slate-50">
              <Miniatura auto={o} path={o.foto_portada} className="h-16 w-20 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{o.folio}</span>
                  {o.os_bitacora && <span className="text-xs text-slate-400">OS {o.os_bitacora}</span>}
                  {o.prioridad && o.prioridad !== 'normal' && <span className="rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700 uppercase">{o.prioridad}</span>}
                </div>
                <div className="truncate text-sm font-medium text-slate-700">{o.marca} {o.modelo} {o.anio ?? ''}</div>
                <div className="truncate text-xs text-slate-500">{o.placas ?? 's/placas'} · {o.tipo === 'aseguradora' ? o.aseguradora_nombre : 'Particular'} · {o.cliente_nombre}</div>
                <div className="mt-1 flex items-center gap-2"><BadgeEtapa etapa={o.etapa} />{retraso && <span className="text-[11px] font-semibold text-red-600">Retrasada</span>}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
