import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, Car, CheckCircle2, Clock, FileClock, Flag, GanttChart, Hammer, KanbanSquare, Layers,
  List, ListChecks, Paintbrush, RotateCcw, ScanSearch, Settings2, SlidersHorizontal, ShieldCheck, Sparkles, SprayCan, Target, TrendingDown, TrendingUp, Truck, User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { ETAPAS, ETAPAS_TABLERO, fecha, type Etapa } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Badge, Card, Empty, Modal, PageHeader } from '../../components/ui'
import { Galeria, Miniatura } from '../../components/Fotos'
import { CambioEtapa } from '../expediente/General'
import { ListaActividades } from '../taller/produccion'
import { EtapaBadge } from '../Inicio'

/* ---------------------------- Estilo por etapa ---------------------------- */
const ESTILO: Record<Etapa, { icon: LucideIcon; head: string; body: string; texto: string }> = {
  recepcion:              { icon: Car,            head: 'bg-sky-100',     body: 'bg-sky-50/60',     texto: 'text-sky-800' },
  diagnostico:            { icon: ScanSearch,     head: 'bg-emerald-100', body: 'bg-emerald-50/60', texto: 'text-emerald-800' },
  esperando_autorizacion: { icon: FileClock,      head: 'bg-amber-100',   body: 'bg-amber-50/60',   texto: 'text-amber-800' },
  en_reparacion:          { icon: Settings2,      head: 'bg-blue-100',    body: 'bg-blue-50/60',    texto: 'text-blue-800' },
  hojalateria:            { icon: Hammer,         head: 'bg-teal-100',    body: 'bg-teal-50/60',    texto: 'text-teal-800' },
  preparacion:            { icon: SprayCan,       head: 'bg-violet-100',  body: 'bg-violet-50/60',  texto: 'text-violet-800' },
  pintura:                { icon: Paintbrush,     head: 'bg-purple-100',  body: 'bg-purple-50/60',  texto: 'text-purple-800' },
  detallado:              { icon: Sparkles,       head: 'bg-indigo-100',  body: 'bg-indigo-50/60',  texto: 'text-indigo-800' },
  control_calidad:        { icon: ShieldCheck,    head: 'bg-cyan-100',    body: 'bg-cyan-50/60',    texto: 'text-cyan-800' },
  listo_entrega:          { icon: Flag,           head: 'bg-green-100',   body: 'bg-green-50/60',   texto: 'text-green-800' },
  entregado:              { icon: Truck,          head: 'bg-slate-200',   body: 'bg-slate-100/60',  texto: 'text-slate-700' },
  cancelado:              { icon: AlertTriangle,  head: 'bg-red-100',     body: 'bg-red-50/60',     texto: 'text-red-800' },
}
const EN_ESPERA: Etapa[] = ['recepcion', 'diagnostico', 'esperando_autorizacion']
const EN_PROCESO: Etapa[] = ['en_reparacion', 'hojalateria', 'preparacion', 'pintura', 'detallado', 'control_calidad']
const PRIORIDAD: Record<string, { label: string; cls: string }> = {
  normal: { label: 'Normal', cls: 'bg-slate-100 text-slate-600' },
  alta: { label: 'Alta', cls: 'bg-amber-100 text-amber-800' },
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-700' },
}
const responsable = (o: VOrden) => o.tecnicos_activos ?? o.asesor_nombre ?? 'Sin responsable'

/* ---------------------------- Indicadores ---------------------------- */
function Tendencia({ valor, sufijo = '%', invertir = false }: { valor: number | null; sufijo?: string; invertir?: boolean }) {
  if (valor === null || !isFinite(valor)) return <span className="text-[11px] text-slate-400">Sin comparativo</span>
  const bueno = invertir ? valor <= 0 : valor >= 0
  const Icono = valor >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${bueno ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-600'}`}>
      <Icono className="h-3 w-3" />{valor > 0 ? '+' : ''}{valor.toFixed(sufijo === '%' ? 0 : 1)}{sufijo}
    </span>
  )
}

function Kpi({ icon: Icon, valor, label, tono, pie, to }: { icon: LucideIcon; valor: ReactNode; label: string; tono: string; pie?: ReactNode; to?: string }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tono}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <div className="text-3xl leading-none font-extrabold text-slate-900">{valor}</div>
          <div className="mt-1 text-sm leading-tight text-slate-500">{label}</div>
        </div>
      </div>
      {pie && <div className="mt-3">{pie}</div>}
    </>
  )
  const cls = 'card !p-4 transition hover:-translate-y-0.5 hover:shadow-lg'
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

function Anillo({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 76 76" className="h-20 w-20 -rotate-90" role="img" aria-label={`Avance ${Math.round(pct)}%`}>
      <circle cx="38" cy="38" r={r} fill="none" stroke="#e7efe9" strokeWidth="9" />
      <circle cx="38" cy="38" r={r} fill="none" stroke="url(#gAvance)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="transition-all duration-700" />
      <defs><linearGradient id="gAvance" x1="0" x2="1"><stop offset="0" stopColor="#1db464" /><stop offset="1" stopColor="#0f7b44" /></linearGradient></defs>
      <text x="38" y="43" textAnchor="middle" className="rotate-90 fill-slate-900 text-[17px] font-extrabold" style={{ transformOrigin: '38px 38px' }}>{Math.round(pct)}%</text>
    </svg>
  )
}

function useIndicadores(activas: VOrden[]) {
  const [mes, setMes] = useState<{ ent: number; entAnt: number; cump: number | null; cumpAnt: number | null }>({ ent: 0, entAnt: 0, cump: null, cumpAnt: null })
  useEffect(() => {
    const hoy = new Date()
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toLocaleDateString('en-CA')
    const iniAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toLocaleDateString('en-CA')
    supabase.from('v_ordenes').select('fecha_entrega, fecha_compromiso, entregado_a_tiempo').eq('etapa', 'entregado').gte('fecha_entrega', iniAnt).then(({ data }) => {
      const rs = data ?? []
      const actual = rs.filter(r => r.fecha_entrega! >= ini), ant = rs.filter(r => r.fecha_entrega! < ini)
      const cumpl = (xs: typeof rs) => { const c = xs.filter(x => x.fecha_compromiso); return c.length ? (c.filter(x => x.entregado_a_tiempo).length / c.length) * 100 : null }
      setMes({ ent: actual.length, entAnt: ant.length, cump: cumpl(actual), cumpAnt: cumpl(ant) })
    })
  }, [activas.length])
  // Avance general: posición promedio de las órdenes activas dentro del flujo de producción (recepción = 0 %, listo para entrega = 100 %)
  const flujo: Etapa[] = ETAPAS_TABLERO.filter(e => e !== 'entregado')
  const avance = activas.length ? (activas.reduce((s, o) => s + Math.max(0, flujo.indexOf(o.etapa)) / (flujo.length - 1), 0) / activas.length) * 100 : 0
  const varEnt = mes.entAnt > 0 ? ((mes.ent - mes.entAnt) / mes.entAnt) * 100 : null
  const varCump = mes.cump !== null && mes.cumpAnt !== null ? mes.cump - mes.cumpAnt : null
  return { ...mes, avance, varEnt, varCump }
}

/* ---------------------------- Filtros ---------------------------- */
interface Filtros { sucursal: string; tipo: string; aseguradora: string; etapa: string; prioridad: string; responsable: string }
const SIN_FILTROS: Filtros = { sucursal: '', tipo: '', aseguradora: '', etapa: '', prioridad: '', responsable: '' }

function BarraFiltros({ f, setF, ordenes }: { f: Filtros; setF: (f: Filtros) => void; ordenes: VOrden[] }) {
  const [sucursales, setSucursales] = useState<{ id: number; nombre: string }[]>([])
  useEffect(() => { supabase.from('sucursales').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => setSucursales(data ?? [])) }, [])
  const aseguradoras = [...new Set(ordenes.map(o => o.aseguradora_nombre).filter(Boolean))] as string[]
  const responsables = [...new Set(ordenes.flatMap(o => [...(o.tecnicos_activos?.split(', ') ?? []), o.asesor_nombre].filter(Boolean)))] as string[]
  const sel = (k: keyof Filtros, label: string, opciones: [string, string][]) => (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="font-semibold whitespace-nowrap text-slate-600">{label}:</span>
      <select className="input !w-auto min-w-28 !py-2" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}>
        <option value="">Todas</option>{opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
  const activos = Object.values(f).filter(Boolean).length
  const [abierto, setAbierto] = useState(false)
  return (
    <>
    <button className="btn btn-secondary mb-3 w-full md:hidden" onClick={() => setAbierto(!abierto)}><SlidersHorizontal className="h-4 w-4" /> Filtros{activos ? ` (${activos})` : ''}</button>
    <div className={`card mb-4 flex-wrap items-center gap-x-5 gap-y-3 !py-3 md:flex ${abierto ? 'flex' : 'hidden'}`}>
      {sel('sucursal', 'Sucursal', sucursales.map(s => [String(s.id), s.nombre]))}
      {sel('tipo', 'Tipo de orden', [['aseguradora', 'Aseguradora'], ['particular', 'Particular']])}
      {sel('aseguradora', 'Aseguradora', aseguradoras.map(a => [a, a]))}
      {sel('etapa', 'Etapa', ETAPAS_TABLERO.map(e => [e, ETAPAS[e].label]))}
      {sel('prioridad', 'Prioridad', Object.entries(PRIORIDAD).map(([k, v]) => [k, v.label]))}
      {sel('responsable', 'Responsable', responsables.sort().map(r => [r, r]))}
      <button className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline disabled:text-slate-300 disabled:no-underline" disabled={!activos} onClick={() => setF(SIN_FILTROS)}>
        <RotateCcw className="h-4 w-4" /> Limpiar filtros{activos ? ` (${activos})` : ''}
      </button>
    </div>
    </>
  )
}

function aplicar(ordenes: VOrden[], f: Filtros) {
  return ordenes.filter(o =>
    (!f.sucursal || String(o.sucursal_id) === f.sucursal) && (!f.tipo || o.tipo === f.tipo) &&
    (!f.aseguradora || o.aseguradora_nombre === f.aseguradora) && (!f.etapa || o.etapa === f.etapa) &&
    (!f.prioridad || o.prioridad === f.prioridad) &&
    (!f.responsable || o.asesor_nombre === f.responsable || (o.tecnicos_activos?.split(', ') ?? []).includes(f.responsable)))
}

/* ---------------------------- Panel rápido ---------------------------- */
function PanelVehiculo({ id, onClose }: { id: number; onClose: () => void }) {
  const al = useAlertas()
  const nav = useNavigate()
  const [o, setO] = useState<VOrden | null>(null)
  const cargar = () => supabase.from('v_ordenes').select('*').eq('id', id).single().then(({ data }) => setO(data as VOrden))
  useEffect(() => { cargar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  return (
    <Modal title={`${o.folio} · ${o.marca} ${o.modelo} ${o.anio ?? ''}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <Miniatura path={o.foto_portada} className="h-24 w-36" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2"><EtapaBadge o={o} /><Badge cls={PRIORIDAD[o.prioridad]?.cls ?? ''}>Prioridad {PRIORIDAD[o.prioridad]?.label}</Badge>{o.detenido_material && <Badge cls="bg-orange-100 text-orange-700">Detenido por material</Badge>}</div>
          <div><b>{o.aseguradora_nombre ?? 'Particular'}</b>{o.siniestro && ` · Siniestro ${o.siniestro}`} · {o.cliente_nombre}{o.placas && ` · ${o.placas}`}</div>
          <div className="text-slate-600">Responsable: {responsable(o)} · Ingreso {fecha(o.fecha_ingreso)} · Compromiso <b className={o.retrasado ? 'text-red-600' : ''}>{fecha(o.fecha_compromiso)}</b></div>
          <div className="text-slate-600">{o.dias_en_etapa} día(s) en esta etapa · {o.dias_en_taller} día(s) en el taller</div>
        </div>
        <button className="btn btn-primary" onClick={() => nav(`/ordenes/${o.id}`)}>Abrir orden de trabajo</button>
      </div>
      <div className="space-y-4">
        <CambioEtapa o={o} recargar={() => { cargar(); al.recargar() }} />
        <Card title="Evidencias del proceso"><Galeria ordenId={o.id} categoria="proceso" puedeSubir={!cerrada} /></Card>
      </div>
    </Modal>
  )
}

/* ---------------------------- Vistas ---------------------------- */
function Tarjeta({ o, onClick }: { o: VOrden; onClick: () => void }) {
  const est = o.retrasado ? { t: 'Retrasado', c: 'bg-red-100 text-red-700' } : o.detenido_material ? { t: 'Detenido', c: 'bg-orange-100 text-orange-700' } : { t: ETAPAS[o.etapa].label, c: ETAPAS[o.etapa].badge }
  return (
    <button onClick={onClick} className={`group w-full rounded-xl border bg-white p-3 text-left shadow-[0_1px_2px_rgba(16,24,20,.06)] transition hover:-translate-y-0.5 hover:shadow-md ${o.retrasado ? 'border-red-200' : 'border-slate-200/70'}`}>
      <div className="flex gap-3">
        <Miniatura path={o.foto_portada} className="h-14 w-[72px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1"><span className="text-sm font-extrabold text-slate-900">{o.folio}</span>{o.prioridad !== 'normal' && <Badge cls={PRIORIDAD[o.prioridad].cls}>{PRIORIDAD[o.prioridad].label}</Badge>}</div>
          <div className="truncate text-xs font-semibold text-slate-700 uppercase">{o.marca} {o.modelo} {o.anio}</div>
          <div className="truncate text-[11px] text-slate-500">{o.aseguradora_nombre ?? 'Particular'}{o.placas && ` · ${o.placas}`}</div>
        </div>
      </div>
      <div className="mt-2.5 space-y-1 text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5 truncate"><User className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate uppercase">{responsable(o)}</span></div>
        <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />Ingreso {fecha(o.fecha_ingreso)}</div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Badge cls={est.c}>{est.t}</Badge>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600" title="Días en la etapa actual">{o.dias_en_etapa} d</span>
      </div>
    </button>
  )
}

function Tablero({ ordenes, onVer, verEntregados, setVerEntregados }: { ordenes: VOrden[]; onVer: (id: number) => void; verEntregados: boolean; setVerEntregados: (v: boolean) => void }) {
  const columnas = ETAPAS_TABLERO.filter(e => verEntregados || e !== 'entregado')
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Toca una tarjeta para ver el detalle, cambiar la etapa o subir evidencias.</span>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={verEntregados} onChange={e => setVerEntregados(e.target.checked)} /> Mostrar entregados (últimos 7 días)</label>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {columnas.map(e => {
          const items = ordenes.filter(o => o.etapa === e)
          const E = ESTILO[e]
          return (
            <section key={e} className={`flex w-[264px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl ${E.body}`}>
              <header className={`flex items-center gap-2 px-3 py-3 ${E.head}`}>
                <E.icon className={`h-5 w-5 ${E.texto}`} />
                <span className={`flex-1 text-sm leading-tight font-bold ${E.texto}`}>{ETAPAS[e].label}</span>
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-700 shadow-sm">{items.length}</span>
              </header>
              <div className="flex max-h-[68vh] min-h-40 flex-col gap-2.5 overflow-y-auto p-2.5">
                {items.length === 0 && <div className="py-8 text-center text-xs text-slate-400">Sin vehículos</div>}
                {items.map(o => <Tarjeta key={o.id} o={o} onClick={() => onVer(o.id)} />)}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Lista({ ordenes, onVer }: { ordenes: VOrden[]; onVer: (id: number) => void }) {
  return (
    <Card pad={false}>
      {ordenes.length === 0 ? <Empty icon={Car}>Sin órdenes con estos filtros</Empty> : (
        <div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Orden</th><th>Vehículo</th><th>Cliente / Aseguradora</th><th>Etapa</th><th>Prioridad</th><th>Responsable</th><th>Ingreso</th><th>Compromiso</th><th className="text-right">Días en etapa</th></tr></thead>
          <tbody>{ordenes.map(o => (
            <tr key={o.id} className="cursor-pointer" onClick={() => onVer(o.id)}>
              <td className="font-bold">{o.folio}</td>
              <td><div className="flex items-center gap-3"><Miniatura path={o.foto_portada} /><div>{o.marca} {o.modelo} {o.anio}<div className="text-xs text-slate-500">{o.placas}</div></div></div></td>
              <td>{o.aseguradora_nombre ?? 'Particular'}<div className="text-xs text-slate-500">{o.cliente_nombre}</div></td>
              <td><EtapaBadge o={o} /></td><td><Badge cls={PRIORIDAD[o.prioridad].cls}>{PRIORIDAD[o.prioridad].label}</Badge></td>
              <td className="text-xs">{responsable(o)}</td><td>{fecha(o.fecha_ingreso)}</td>
              <td className={o.retrasado ? 'font-semibold text-red-600' : ''}>{fecha(o.fecha_compromiso)}</td><td className="text-right">{o.dias_en_etapa}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </Card>
  )
}

/** Gantt: barra de cada orden desde su ingreso hasta su fecha compromiso, con la línea de hoy */
function Gantt({ ordenes, onVer }: { ordenes: VOrden[]; onVer: (id: number) => void }) {
  const dia = 86400000
  const hoy = new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00').getTime()
  const filas = ordenes.filter(o => o.etapa !== 'entregado').map(o => {
    const ini = new Date(new Date(o.fecha_ingreso).toLocaleDateString('en-CA') + 'T00:00:00').getTime()
    const fin = o.fecha_compromiso ? new Date(o.fecha_compromiso + 'T00:00:00').getTime() : ini + 7 * dia
    return { o, ini, fin }
  }).sort((a, b) => a.fin - b.fin)
  if (!filas.length) return <Card><Empty icon={GanttChart}>Sin órdenes activas con estos filtros</Empty></Card>
  const min = Math.min(hoy - 3 * dia, ...filas.map(f => f.ini)), max = Math.max(hoy + 7 * dia, ...filas.map(f => f.fin)) + dia
  const total = (max - min) / dia
  const pos = (t: number) => ((t - min) / (max - min)) * 100
  const dias = Array.from({ length: total }, (_, i) => new Date(min + i * dia))
  return (
    <Card pad={false}>
      <div className="overflow-x-auto"><div className="min-w-[760px]">
        <div className="flex border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
          <div className="w-56 shrink-0 px-3 py-2">Orden</div>
          <div className="relative flex-1">{dias.map((d, i) => (d.getDate() === 1 || i % Math.ceil(total / 14) === 0) && <span key={i} className="absolute top-2 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(d.getTime())}%` }}>{d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>)}</div>
        </div>
        {filas.map(({ o, ini, fin }) => (
          <div key={o.id} className="flex items-center border-b border-slate-100 hover:bg-brand-50/40">
            <button onClick={() => onVer(o.id)} className="w-56 shrink-0 truncate px-3 py-2.5 text-left text-xs"><b>{o.folio}</b> · {o.marca} {o.modelo}<div className="text-[10px] text-slate-500">{ETAPAS[o.etapa].label}</div></button>
            <div className="relative h-10 flex-1">
              <div className="absolute inset-y-0 w-0.5 bg-red-500/80" style={{ left: `${pos(hoy)}%` }} title="Hoy" />
              <button onClick={() => onVer(o.id)} title={`${fecha(o.fecha_ingreso)} → ${fecha(o.fecha_compromiso)}`}
                className={`absolute top-2.5 h-5 rounded-full text-[10px] font-bold text-white shadow-sm ${o.retrasado ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-brand-600 to-brand-400'}`}
                style={{ left: `${pos(ini)}%`, width: `${Math.max(pos(fin + dia) - pos(ini), 1.5)}%` }}>
                <span className="px-2">{Math.round((fin - ini) / dia) + 1} d</span>
              </button>
            </div>
          </div>
        ))}
      </div></div>
      <p className="px-5 py-3 text-xs text-slate-500">Cada barra va del ingreso a la fecha compromiso. La línea roja es hoy; en rojo, las órdenes retrasadas.</p>
    </Card>
  )
}

/* ---------------------------- Página ---------------------------- */
const VISTAS = [
  { id: 'tablero', label: 'Tablero de producción', icon: KanbanSquare },
  { id: 'trabajos', label: 'Trabajos en curso', icon: ListChecks },
  { id: 'lista', label: 'Vista de lista', icon: List },
  { id: 'gantt', label: 'Gantt de producción', icon: GanttChart },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
]

export default function Procesos() {
  const al = useAlertas()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const vista = sp.get('tab') ?? 'tablero'
  const [f, setF] = useState<Filtros>(SIN_FILTROS)
  const [ver, setVer] = useState<number | null>(null)
  const [verEntregados, setVerEntregados] = useState(false)
  const [entregadas, setEntregadas] = useState<VOrden[]>([])
  const ind = useIndicadores(al.activas)

  useEffect(() => {
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7)
    supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').gte('fecha_entrega', hace7.toISOString()).order('fecha_entrega', { ascending: false })
      .then(({ data }) => setEntregadas((data ?? []) as VOrden[]))
  }, [al.activas])

  const todas = useMemo(() => [...al.activas, ...(verEntregados ? entregadas : [])], [al.activas, entregadas, verEntregados])
  const filtradas = useMemo(() => aplicar(todas, f), [todas, f])
  const cambiarVista = (id: string) => id === 'calendario' ? nav('/calendario') : setSp(new URLSearchParams({ tab: id }))

  return (
    <div>
      <PageHeader title="Procesos del taller" subtitle="Tablero de producción por etapa" />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={Car} tono="bg-brand-50 text-brand-700" valor={al.activas.length} label="Órdenes activas" to="/ordenes?filtro=activos" pie={<span className="text-[11px] text-slate-400">{al.activas.filter(o => o.tipo === 'particular').length} particulares · {al.activas.filter(o => o.tipo === 'aseguradora').length} aseguradora</span>} />
        <Kpi icon={Layers} tono="bg-emerald-50 text-emerald-700" valor={al.activas.filter(o => EN_PROCESO.includes(o.etapa)).length} label="En proceso" pie={<span className="text-[11px] text-slate-400">Reparación, hojalatería, pintura…</span>} />
        <Kpi icon={Clock} tono="bg-amber-50 text-amber-600" valor={al.activas.filter(o => EN_ESPERA.includes(o.etapa)).length} label="En espera" pie={<span className="text-[11px] text-slate-400">{al.detenidas.length} detenido(s) por material</span>} />
        <Kpi icon={CheckCircle2} tono="bg-green-50 text-green-700" valor={ind.ent} label="Entregadas (mes)" to="/ordenes?filtro=etapa:entregado" pie={<Tendencia valor={ind.varEnt} />} />
        <Kpi icon={Target} tono="bg-teal-50 text-teal-700" valor={ind.cump === null ? '—' : `${Math.round(ind.cump)}%`} label="Cumplimiento" pie={<Tendencia valor={ind.varCump} sufijo=" pp" />} />
        <div className="card flex items-center justify-between gap-2 !p-4">
          <div><div className="text-sm leading-tight font-bold text-slate-800">Avance general<br />del taller</div><div className="mt-1 text-[11px] text-slate-400">Posición promedio en el flujo</div></div>
          <Anillo pct={ind.avance} />
        </div>
      </div>

      <div className="no-print mb-4 flex gap-2 overflow-x-auto pb-1">
        {VISTAS.map(v => (
          <button key={v.id} onClick={() => cambiarVista(v.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition ${vista === v.id ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-900/20' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>
            <v.icon className="h-4 w-4" />{v.label}
          </button>
        ))}
      </div>

      {vista !== 'trabajos' && <BarraFiltros f={f} setF={setF} ordenes={todas} />}

      {vista === 'tablero' && <Tablero ordenes={filtradas} onVer={setVer} verEntregados={verEntregados} setVerEntregados={setVerEntregados} />}
      {vista === 'trabajos' && <ListaActividades />}
      {vista === 'lista' && <Lista ordenes={filtradas} onVer={setVer} />}
      {vista === 'gantt' && <Gantt ordenes={filtradas} onVer={setVer} />}
      {ver && <PanelVehiculo id={ver} onClose={() => { setVer(null); al.recargar() }} />}
    </div>
  )
}
