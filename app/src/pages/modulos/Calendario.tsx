import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, PackageX, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { AREAS, errorTexto, hoyISO } from '../../lib/format'
import { Card, ErrorMsg, Field, Modal, PageHeader } from '../../components/ui'

type Vista = 'dia' | 'semana' | 'mes'
interface Evento { id: string; fecha: string; hora?: string; tipo: keyof typeof TIPOS; titulo: string; sub?: string; to: string; alerta?: boolean }

const TIPOS = {
  cita: { label: 'Cita de recepción', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  seguimiento: { label: 'Cita / llamada con cliente', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  compromiso: { label: 'Fecha compromiso', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  entrega: { label: 'Entrega realizada', cls: 'bg-green-100 text-green-800 border-green-300' },
  trabajo: { label: 'Trabajo programado', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  asignacion: { label: 'Asignación recibida', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
} as const

const iso = (d: Date) => d.toLocaleDateString('en-CA')
const sumar = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const lunes = (d: Date) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x }
const horaDe = (ts: string) => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

function ProgramarTrabajo({ onDone }: { onDone: () => void }) {
  const [acts, setActs] = useState<{ id: number; actividad: string; pieza: string | null; fecha_programada: string | null; tecnicos: { nombre: string }; ordenes: { folio: string } }[]>([])
  const [f, setF] = useState({ id: '', fecha: hoyISO() })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('actividades').select('id, actividad, pieza, fecha_programada, tecnicos(nombre), ordenes(folio)').in('estado', ['asignada', 'en_proceso']).order('fecha_programada', { nullsFirst: true })
      .then(({ data }) => setActs((data ?? []) as unknown as typeof acts))
  }, [])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('actividades').update({ fecha_programada: f.fecha }).eq('id', Number(f.id))
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorMsg error={error} />
      <Field label="Trabajo pendiente *">
        <select className="input" required value={f.id} onChange={e => setF({ ...f, id: e.target.value })}>
          <option value="">Selecciona…</option>
          {acts.map(a => <option key={a.id} value={a.id}>{a.ordenes.folio} · {a.actividad}{a.pieza ? ` (${a.pieza})` : ''} · {a.tecnicos.nombre}{a.fecha_programada ? ` · programado ${a.fecha_programada}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Fecha programada *"><input className="input" type="date" required value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
      {acts.length === 0 && <p className="text-xs text-slate-500">No hay trabajos pendientes. Se asignan desde la orden o en Mano de obra.</p>}
      <div className="flex justify-end"><button className="btn btn-primary">Programar</button></div>
    </form>
  )
}

export default function Calendario() {
  const { puede } = useAuth()
  const al = useAlertas()
  const [vista, setVista] = useState<Vista>('semana')
  const [ref, setRef] = useState(new Date())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [carga, setCarga] = useState<{ tecnico: string; area: string; fecha: string }[]>([])
  const [programar, setProgramar] = useState(false)
  const [filtros, setFiltros] = useState<Record<string, boolean>>(Object.fromEntries(Object.keys(TIPOS).map(k => [k, true])))

  const { desde, hasta, dias } = useMemo(() => {
    if (vista === 'dia') return { desde: new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()), hasta: sumar(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()), 1), dias: [new Date(ref)] }
    if (vista === 'semana') { const l = lunes(ref); return { desde: l, hasta: sumar(l, 7), dias: Array.from({ length: 7 }, (_, i) => sumar(l, i)) } }
    const ini = lunes(new Date(ref.getFullYear(), ref.getMonth(), 1))
    return { desde: ini, hasta: sumar(ini, 42), dias: Array.from({ length: 42 }, (_, i) => sumar(ini, i)) }
  }, [vista, ref])

  const cargar = useCallback(async () => {
    const d = iso(desde), h = iso(hasta)
    const [cit, seg, comp, ent, act, asig] = await Promise.all([
      supabase.from('asignaciones').select('id, siniestro, asegurado, marca, modelo, fecha_cita, estatus').eq('estatus', 'cita_programada').gte('fecha_cita', d).lt('fecha_cita', h),
      supabase.from('cliente_seguimientos').select('id, cliente_id, tipo, notas, fecha_cita, clientes(nombre)').gte('fecha_cita', d).lt('fecha_cita', h),
      supabase.from('v_ordenes').select('id, folio, marca, modelo, placas, fecha_compromiso, retrasado, etapa').not('etapa', 'in', '(entregado,cancelado)').gte('fecha_compromiso', d).lt('fecha_compromiso', h),
      supabase.from('v_ordenes').select('id, folio, marca, modelo, fecha_entrega, entregado_a_tiempo').eq('etapa', 'entregado').gte('fecha_entrega', d).lt('fecha_entrega', h),
      supabase.from('actividades').select('id, orden_id, actividad, pieza, area, fecha_programada, estado, tecnicos(nombre), ordenes(folio)').gte('fecha_programada', d).lt('fecha_programada', h).neq('estado', 'cancelada'),
      supabase.from('asignaciones').select('id, siniestro, asegurado, fecha_asignacion').gte('fecha_asignacion', d).lt('fecha_asignacion', h),
    ])
    const ev: Evento[] = []
    for (const a of cit.data ?? []) ev.push({ id: 'c' + a.id, fecha: iso(new Date(a.fecha_cita!)), hora: horaDe(a.fecha_cita!), tipo: 'cita', titulo: `Cita · ${a.asegurado}`, sub: `${a.siniestro} · ${[a.marca, a.modelo].filter(Boolean).join(' ')}`, to: `/ordenes?tab=asignaciones&ver=${a.id}` })
    for (const s of (seg.data ?? []) as unknown as { id: number; cliente_id: number; tipo: string; notas: string; fecha_cita: string; clientes: { nombre: string } }[])
      ev.push({ id: 's' + s.id, fecha: iso(new Date(s.fecha_cita)), hora: horaDe(s.fecha_cita), tipo: 'seguimiento', titulo: s.clientes?.nombre ?? 'Cliente', sub: s.notas, to: `/clientes/${s.cliente_id}?tab=seguimiento` })
    for (const o of comp.data ?? []) ev.push({ id: 'p' + o.id, fecha: o.fecha_compromiso!, tipo: 'compromiso', titulo: `${o.folio} · ${o.marca} ${o.modelo}`, sub: o.placas ?? '', to: `/ordenes/${o.id}`, alerta: o.retrasado })
    for (const o of ent.data ?? []) ev.push({ id: 'e' + o.id, fecha: iso(new Date(o.fecha_entrega!)), hora: horaDe(o.fecha_entrega!), tipo: 'entrega', titulo: `${o.folio} · ${o.marca} ${o.modelo}`, sub: o.entregado_a_tiempo ? 'A tiempo' : 'Fuera de plazo', to: `/ordenes/${o.id}?tab=entrega`, alerta: !o.entregado_a_tiempo })
    const acts = (act.data ?? []) as unknown as { id: number; orden_id: number; actividad: string; pieza: string | null; area: string; fecha_programada: string; estado: string; tecnicos: { nombre: string }; ordenes: { folio: string } }[]
    for (const a of acts) ev.push({ id: 't' + a.id, fecha: a.fecha_programada, tipo: 'trabajo', titulo: `${a.ordenes.folio} · ${a.actividad}`, sub: a.tecnicos.nombre, to: `/ordenes/${a.orden_id}?tab=trabajos`, alerta: a.fecha_programada < hoyISO() && ['asignada', 'en_proceso'].includes(a.estado) })
    for (const a of asig.data ?? []) ev.push({ id: 'a' + a.id, fecha: a.fecha_asignacion, tipo: 'asignacion', titulo: `Asignación ${a.siniestro}`, sub: a.asegurado, to: `/ordenes?tab=asignaciones&ver=${a.id}` })
    setEventos(ev)
    setCarga(acts.map(a => ({ tecnico: a.tecnicos.nombre, area: a.area, fecha: a.fecha_programada })))
  }, [desde, hasta])
  useEffect(() => { cargar() }, [cargar])

  const mover = (n: number) => setRef(r => vista === 'mes' ? new Date(r.getFullYear(), r.getMonth() + n, 1) : sumar(r, vista === 'semana' ? 7 * n : n))
  const titulo = vista === 'mes' ? ref.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    : vista === 'semana' ? `${dias[0].toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${dias[6].toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ref.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const visibles = eventos.filter(e => filtros[e.tipo])
  const delDia = (d: Date) => visibles.filter(e => e.fecha === iso(d)).sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'))
  const hoy = hoyISO()

  const Chip = ({ e, compacto }: { e: Evento; compacto?: boolean }) => (
    <Link to={e.to} title={`${TIPOS[e.tipo].label}: ${e.titulo}${e.sub ? ' · ' + e.sub : ''}`}
      className={`block rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight hover:brightness-95 ${TIPOS[e.tipo].cls} ${e.alerta ? '!border-red-500' : ''}`}>
      <div className="truncate font-semibold">{e.alerta && '⚠ '}{e.hora && `${e.hora} · `}{e.titulo}</div>
      {!compacto && e.sub && <div className="truncate opacity-80">{e.sub}</div>}
    </Link>
  )

  const tecnicos = [...new Set(carga.map(c => c.tecnico))].sort()
  const retrasadas = eventos.filter(e => e.tipo === 'trabajo' && e.alerta)

  return (
    <div className="space-y-5">
      <PageHeader title="Calendario y planeación" subtitle="Citas, programación de trabajos, carga por técnico, fechas compromiso y entregas">
        {puede('actividades.asignar') && <button className="btn btn-primary" onClick={() => setProgramar(true)}><Plus className="h-4 w-4" /> Programar trabajo</button>}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
          {(['dia', 'semana', 'mes'] as Vista[]).map(v => <button key={v} onClick={() => setVista(v)} className={`px-4 py-2 text-sm font-semibold ${vista === v ? 'bg-navy-800 text-white' : 'bg-white text-slate-600'}`}>{v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}</button>)}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => mover(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn btn-secondary btn-sm" onClick={() => setRef(new Date())}>Hoy</button>
        <button className="btn btn-secondary btn-sm" onClick={() => mover(1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
        <span className="text-lg font-bold">{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPOS).map(([k, t]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${filtros[k] ? t.cls : 'border-slate-200 bg-white text-slate-400'}`}>
            <input type="checkbox" className="hidden" checked={filtros[k]} onChange={e => setFiltros({ ...filtros, [k]: e.target.checked })} />{t.label} ({eventos.filter(e => e.tipo === k).length})
          </label>
        ))}
      </div>

      {vista === 'mes' && (
        <div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 gap-px">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="bg-slate-50 py-2 text-center text-xs font-bold text-slate-500">{d}</div>)}
          {dias.map(d => {
            const evs = delDia(d)
            const fuera = d.getMonth() !== ref.getMonth()
            return (
              <div key={iso(d)} className={`min-h-28 bg-white p-1.5 ${fuera ? 'opacity-40' : ''}`}>
                <button onClick={() => { setRef(d); setVista('dia') }} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${iso(d) === hoy ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{d.getDate()}</button>
                <div className="space-y-1">{evs.slice(0, 3).map(e => <Chip key={e.id} e={e} compacto />)}
                  {evs.length > 3 && <button onClick={() => { setRef(d); setVista('dia') }} className="text-[11px] font-semibold text-blue-600">+{evs.length - 3} más</button>}</div>
              </div>
            )
          })}
        </div></div>
      )}

      {vista === 'semana' && (
        <div className="overflow-x-auto"><div className="grid min-w-[900px] grid-cols-7 gap-2">
          {dias.map(d => (
            <div key={iso(d)} className={`min-h-64 rounded-xl border bg-white p-2 ${iso(d) === hoy ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
              <button onClick={() => { setRef(d); setVista('dia') }} className="mb-2 block w-full text-left">
                <div className="text-xs font-semibold text-slate-500 capitalize">{d.toLocaleDateString('es-MX', { weekday: 'short' })}</div>
                <div className={`text-lg font-extrabold ${iso(d) === hoy ? 'text-blue-600' : ''}`}>{d.getDate()}</div>
              </button>
              <div className="space-y-1">{delDia(d).map(e => <Chip key={e.id} e={e} />)}</div>
            </div>
          ))}
        </div></div>
      )}

      {vista === 'dia' && (
        <Card title={`Agenda del día (${delDia(ref).length})`}>
          {delDia(ref).length === 0 ? <p className="text-sm text-slate-400">Sin eventos este día</p> : (
            <ul className="space-y-2">{delDia(ref).map(e => (
              <li key={e.id}><Link to={e.to} className={`flex items-center gap-3 rounded-xl border-l-4 p-3 ${TIPOS[e.tipo].cls} ${e.alerta ? '!border-red-500' : ''}`}>
                <span className="w-14 text-sm font-bold">{e.hora ?? 'Día'}</span>
                <span className="flex-1"><span className="block text-xs font-semibold opacity-70">{TIPOS[e.tipo].label}{e.alerta && ' · requiere atención'}</span><span className="font-semibold">{e.titulo}</span>{e.sub && <span className="block text-sm opacity-80">{e.sub}</span>}</span>
              </Link></li>))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Carga de trabajo por técnico" className="lg:col-span-2">
          {tecnicos.length === 0 ? <p className="text-sm text-slate-400">Sin trabajos programados en este periodo. Usa “Programar trabajo” para asignar fecha a los trabajos pendientes.</p> : (
            <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
              <thead><tr><th>Técnico</th>{(vista === 'mes' ? [] : dias).map(d => <th key={iso(d)} className="text-center capitalize">{d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}</th>)}<th className="text-right">Total</th></tr></thead>
              <tbody>{tecnicos.map(t => (
                <tr key={t}><td className="font-medium">{t}<div className="text-xs text-slate-400">{[...new Set(carga.filter(c => c.tecnico === t).map(c => AREAS[c.area]))].join(', ')}</div></td>
                  {(vista === 'mes' ? [] : dias).map(d => { const n = carga.filter(c => c.tecnico === t && c.fecha === iso(d)).length; return <td key={iso(d)} className="text-center">{n ? <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${n >= 4 ? 'bg-red-100 text-red-700' : n >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>{n}</span> : <span className="text-slate-300">·</span>}</td> })}
                  <td className="text-right font-bold">{carga.filter(c => c.tecnico === t).length}</td></tr>))}
              </tbody>
            </table></div>
          )}
        </Card>
        <div className="space-y-5">
          <Card title={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Trabajos programados vencidos</span>}>
            {retrasadas.length === 0 ? <p className="text-sm text-slate-400">Ninguno en este periodo</p> : <div className="space-y-1">{retrasadas.map(e => <Chip key={e.id} e={e} />)}</div>}
          </Card>
          <Card title={<span className="flex items-center gap-2"><PackageX className="h-4 w-4 text-orange-500" /> Pendientes de materiales</span>}>
            {al.detenidas.length === 0 ? <p className="text-sm text-slate-400">Ningún vehículo detenido por material</p> : (
              <ul className="divide-y text-sm">{al.detenidas.map(o => <li key={o.id} className="py-1.5"><Link className="font-semibold text-blue-600" to={`/ordenes/${o.id}?tab=materiales`}>{o.folio}</Link> · {o.marca} {o.modelo}{o.motivo_retraso && <div className="text-xs text-slate-500">{o.motivo_retraso}</div>}</li>)}</ul>
            )}
          </Card>
        </div>
      </div>

      {programar && <Modal title="Programar trabajo" onClose={() => setProgramar(false)}><ProgramarTrabajo onDone={() => { setProgramar(false); cargar() }} /></Modal>}
    </div>
  )
}
