import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Play, Plus, RotateCcw, Square, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { revertir } from '../lib/revertir'
import { useAuth } from '../lib/auth'
import { AREAS, ESTADO_ACTIVIDAD, errorTexto, fechaHora, money2, num } from '../lib/format'
import type { Tarifa, Tecnico } from '../lib/tipos'
import { Badge, Empty, ErrorMsg, Field, Modal } from './ui'
import { Galeria } from './Fotos'

export interface Actividad {
  id: number; orden_id: number; area: string; actividad: string; pieza: string | null; tecnico_id: number; tarifa_id: number | null
  importe_destajo: number; estado: string; fecha_asignacion: string; fecha_inicio: string | null; fecha_fin: string | null
  horas: number | null; rechazos: number; motivo_rechazo: string | null; validado_at: string | null
  tecnicos?: { nombre: string; perfil_id: string | null }; ordenes?: { folio: string; etapa: string; tipo: string }
}

function Terminar({ a, onClose, onOk }: { a: Actividad; onClose: () => void; onOk: () => void }) {
  const [horas, setHoras] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hayFoto, setHayFoto] = useState(false)
  useEffect(() => {
    supabase.from('fotos').select('id', { count: 'exact', head: true }).eq('categoria', 'actividad').eq('ref_id', a.id).then(r => setHayFoto((r.count ?? 0) > 0))
  }, [a.id])
  async function terminar() {
    const { error } = await supabase.rpc('actividad_accion', { p_id: a.id, p_accion: 'terminar', p_horas: horas ? Number(horas) : null })
    if (error) return setError(errorTexto(error))
    onOk()
  }
  return (
    <Modal title={`Terminar: ${a.actividad}`} onClose={onClose}>
      <ErrorMsg error={error} />
      <p className="mb-3 text-sm text-slate-600">1. Adjunta al menos una fotografía de evidencia del trabajo terminado.</p>
      <Galeria ordenId={a.orden_id} categoria="actividad" refId={a.id} onCambio={() => setHayFoto(true)} />
      <Field label="2. Tiempo trabajado (horas)" hint="Si lo dejas vacío se calcula desde el inicio" className="mt-4">
        <input className="input" type="number" step="0.25" min="0" value={horas} onChange={e => setHoras(e.target.value)} />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-success" disabled={!hayFoto} onClick={terminar}><CheckCircle2 className="h-4 w-4" /> Marcar como terminado</button>
      </div>
    </Modal>
  )
}

function Evidencia({ a, onClose }: { a: Actividad; onClose: () => void }) {
  return <Modal title={`Evidencia: ${a.actividad}`} onClose={onClose}><Galeria ordenId={a.orden_id} categoria="actividad" refId={a.id} puedeSubir={false} /></Modal>
}

export function NuevaActividad({ ordenId, onDone }: { ordenId?: number; onDone: () => void }) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [ordenes, setOrdenes] = useState<{ id: number; folio: string; marca: string; modelo: string; placas: string | null }[]>([])
  const [f, setF] = useState({ orden_id: ordenId ? String(ordenId) : '', tarifa_id: '', area: 'hojalateria', actividad: '', pieza: '', tecnico_id: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('tarifas_destajo').select('*').eq('activo', true).order('area').order('actividad').then(({ data }) => setTarifas((data ?? []) as Tarifa[]))
    supabase.from('tecnicos').select('*').eq('activo', true).order('nombre').then(({ data }) => setTecnicos((data ?? []) as Tecnico[]))
    if (!ordenId) supabase.from('v_ordenes').select('id,folio,marca,modelo,placas').not('etapa', 'in', '(entregado,cancelado)').order('folio').then(({ data }) => setOrdenes(data ?? []))
  }, [ordenId])
  const tarifa = tarifas.find(t => String(t.id) === f.tarifa_id)
  const tecs = tecnicos.filter(t => !tarifa || t.area === tarifa.area || true)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!tarifa && !f.actividad.trim()) return setError('Elige una tarifa o describe la actividad')
    const { error } = await supabase.from('actividades').insert({
      orden_id: Number(f.orden_id), tarifa_id: tarifa ? tarifa.id : null, area: tarifa?.area ?? f.area,
      actividad: f.actividad.trim() || tarifa?.actividad, pieza: f.pieza || null, tecnico_id: Number(f.tecnico_id),
    })
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
      {!ordenId && (
        <Field label="Orden de trabajo *" className="sm:col-span-2">
          <select className="input" required value={f.orden_id} onChange={e => setF({ ...f, orden_id: e.target.value })}>
            <option value="">Selecciona…</option>{ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.marca} {o.modelo} {o.placas ?? ''}</option>)}
          </select>
        </Field>
      )}
      <Field label="Tarifa de destajo" className="sm:col-span-2" hint={tarifa ? `Importe de destajo: ${money2(tarifa.importe)}` : 'Sin tarifa la actividad no genera destajo. Configura tarifas en Taller → Técnicos y tarifas.'}>
        <select className="input" value={f.tarifa_id} onChange={e => setF({ ...f, tarifa_id: e.target.value })}>
          <option value="">Sin tarifa (no genera destajo)</option>
          {Object.entries(AREAS).map(([k, v]) => {
            const ts = tarifas.filter(t => t.area === k)
            return ts.length ? <optgroup key={k} label={v}>{ts.map(t => <option key={t.id} value={t.id}>{t.actividad} — {money2(t.importe)}</option>)}</optgroup> : null
          })}
        </select>
      </Field>
      {!tarifa && <Field label="Área"><select className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
      <Field label={tarifa ? 'Detalle de la actividad (opcional)' : 'Actividad *'}><input className="input" value={f.actividad} onChange={e => setF({ ...f, actividad: e.target.value })} placeholder={tarifa?.actividad ?? 'Ej. Pulido general'} /></Field>
      <Field label="Pieza intervenida"><input className="input" value={f.pieza} onChange={e => setF({ ...f, pieza: e.target.value })} placeholder="Ej. Salpicadera derecha" /></Field>
      <Field label="Técnico responsable *">
        <select className="input" required value={f.tecnico_id} onChange={e => setF({ ...f, tecnico_id: e.target.value })}>
          <option value="">Selecciona…</option>{tecs.map(t => <option key={t.id} value={t.id}>{t.nombre} ({AREAS[t.area]})</option>)}
        </select>
      </Field>
      {tecnicos.length === 0 && <p className="text-xs text-amber-700 sm:col-span-2">No hay técnicos registrados. Agrégalos en Taller → Técnicos y tarifas.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn btn-primary">Asignar trabajo</button>
      </div>
    </form>
  )
}

/** Lista de actividades con el flujo: asignada → en proceso → terminada (con evidencia) → validada (genera destajo) */
export default function Actividades({ ordenId, filtroEstado, filtroTecnico, cerrada, onCambio, mostrarOrden }: {
  ordenId?: number; filtroEstado?: string; filtroTecnico?: string; cerrada?: boolean; onCambio?: () => void; mostrarOrden?: boolean
}) {
  const { puede, perfil } = useAuth()
  const [rows, setRows] = useState<Actividad[]>([])
  const [error, setError] = useState<string | null>(null)
  const [terminar, setTerminar] = useState<Actividad | null>(null)
  const [verEv, setVerEv] = useState<Actividad | null>(null)
  const [nueva, setNueva] = useState(false)
  const [avances, setAvances] = useState<Record<number, { porcentaje: number; nota: string | null; created_at: string }>>({})

  const cargar = useCallback(async () => {
    let q = supabase.from('actividades').select('*, tecnicos(nombre, perfil_id), ordenes(folio, etapa, tipo)').order('fecha_asignacion', { ascending: false }).limit(500)
    if (ordenId) q = q.eq('orden_id', ordenId)
    if (filtroEstado === 'abiertas') q = q.in('estado', ['asignada', 'en_proceso', 'terminada'])
    else if (filtroEstado && filtroEstado !== 'todas') q = q.eq('estado', filtroEstado)
    if (filtroTecnico) q = q.eq('tecnico_id', filtroTecnico)
    const { data } = await q
    setRows((data ?? []) as Actividad[])
    const ids = (data ?? []).filter(a => a.estado !== 'cancelada').map(a => a.id)
    if (ids.length) {
      const { data: av } = await supabase.from('v_avance_actual').select('*').in('actividad_id', ids)
      setAvances(Object.fromEntries((av ?? []).map(x => [x.actividad_id, x])))
    } else setAvances({})
  }, [ordenId, filtroEstado, filtroTecnico])
  useEffect(() => { cargar() }, [cargar])

  async function accion(a: Actividad, acc: string) {
    let motivo: string | null = null
    if (acc === 'rechazar') { motivo = prompt('Motivo del retrabajo (quedará registrado):'); if (!motivo) return }
    if (acc === 'cancelar') { motivo = prompt('Motivo de la cancelación:'); if (motivo === null) return }
    if (acc === 'validar' && !confirm(`¿Validar "${a.actividad}"? Se generará un destajo de ${money2(a.importe_destajo)} para ${a.tecnicos?.nombre}.`)) return
    const { error } = await supabase.rpc('actividad_accion', { p_id: a.id, p_accion: acc, p_motivo: motivo })
    setError(error ? errorTexto(error) : null)
    cargar(); onCambio?.()
  }
  async function eliminar(a: Actividad) {
    if (!confirm('¿Eliminar esta actividad sin iniciar?')) return
    const { error } = await supabase.from('actividades').delete().eq('id', a.id)
    setError(error ? errorTexto(error) : null); cargar(); onCambio?.()
  }

  const esMia = (a: Actividad) => !!perfil && a.tecnicos?.perfil_id === perfil.id
  const total = rows.filter(r => r.estado !== 'cancelada').reduce((s, r) => s + Number(r.importe_destajo), 0)

  return (
    <div>
      <ErrorMsg error={error} />
      {!cerrada && puede('actividades.asignar') && (
        <div className="mb-3 flex justify-end"><button className="btn btn-primary" onClick={() => setNueva(true)}><Plus className="h-4 w-4" /> Asignar trabajo</button></div>
      )}
      {rows.length === 0 ? <Empty>Sin trabajos asignados</Empty> : (
        <div className="space-y-2">
          {rows.map(a => {
            const cerradaOrden = a.ordenes?.etapa === 'entregado' || a.ordenes?.etapa === 'cancelado'
            const puedeAvanzar = !cerradaOrden && (esMia(a) || puede('actividades.asignar'))
            return (
              <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge cls={ESTADO_ACTIVIDAD[a.estado].badge}>{ESTADO_ACTIVIDAD[a.estado].label}</Badge>
                    <span className="font-semibold">{a.actividad}</span>
                    {a.pieza && <span className="text-sm text-slate-500">· {a.pieza}</span>}
                    {a.rechazos > 0 && <Badge cls="bg-red-100 text-red-700">Retrabajo ×{a.rechazos}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {mostrarOrden && a.ordenes && <><Link className="font-semibold text-brand-700 hover:underline" to={`/ordenes/${a.orden_id}?tab=trabajos`}>{a.ordenes.folio}</Link> · {a.ordenes.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'} · </>}
                    {AREAS[a.area]} · <b>{a.tecnicos?.nombre}</b> · Destajo {a.importe_destajo > 0 ? money2(a.importe_destajo) : 'sin tarifa'}
                    {a.fecha_inicio && ` · Inicio ${fechaHora(a.fecha_inicio)}`}{a.fecha_fin && ` · Fin ${fechaHora(a.fecha_fin)}`}{a.horas != null && ` · ${num(a.horas)} h`}
                  </div>
                  {a.motivo_rechazo && a.estado !== 'validada' && <div className="mt-0.5 text-xs text-red-600">Motivo: {a.motivo_rechazo}</div>}
                  {(() => {
                    const av = avances[a.id]
                    const pctv = a.estado === 'terminada' || a.estado === 'validada' ? 100 : av?.porcentaje ?? (a.estado === 'en_proceso' ? 0 : null)
                    if (pctv == null) return null
                    return (
                      <div className="mt-2 max-w-md">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 shadow-[0_0_6px_rgba(61,220,132,.6)] transition-all" style={{ width: `${pctv}%` }} /></div>
                          <span className="w-10 text-right text-xs font-bold text-brand-700">{pctv}%</span>
                        </div>
                        {av && <div className="mt-0.5 text-[11px] text-slate-500">Avance reportado {fechaHora(av.created_at)}{av.nota && ` · “${av.nota}”`}</div>}
                      </div>
                    )
                  })()}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['terminada', 'validada'].includes(a.estado) && <button className="btn btn-secondary btn-sm" onClick={() => setVerEv(a)}>Evidencia</button>}
                  {a.estado === 'asignada' && puedeAvanzar && <button className="btn btn-secondary btn-sm" onClick={() => accion(a, 'iniciar')}><Play className="h-3.5 w-3.5" /> Iniciar</button>}
                  {['asignada', 'en_proceso'].includes(a.estado) && puedeAvanzar && <button className="btn btn-success btn-sm" onClick={() => setTerminar(a)}><Square className="h-3.5 w-3.5" /> Terminar</button>}
                  {a.estado === 'terminada' && puede('actividades.validar') && !cerradaOrden && <>
                    <button className="btn btn-success btn-sm" onClick={() => accion(a, 'validar')}><CheckCircle2 className="h-3.5 w-3.5" /> Validar</button>
                    <button className="btn btn-warning btn-sm" onClick={() => accion(a, 'rechazar')}><RotateCcw className="h-3.5 w-3.5" /> Retrabajo</button>
                  </>}
                  {a.estado === 'asignada' && puede('actividades.asignar') && <button className="btn btn-ghost btn-sm text-red-600" onClick={() => eliminar(a)}>Eliminar</button>}
                  {a.estado === 'en_proceso' && puede('actividades.asignar') && <button className="btn btn-ghost btn-sm text-red-600" title="Cancelar trabajo" onClick={() => accion(a, 'cancelar')}><XCircle className="h-3.5 w-3.5" /></button>}
                  {['terminada', 'validada'].includes(a.estado) && puede('excepciones.autorizar') && <button className="btn btn-ghost btn-sm text-red-600" title="Anular trabajo y su destajo" onClick={async () => {
                    const r = await revertir('actividad_anular', { p_id: a.id }, `¿Anular "${a.actividad}" de ${a.tecnicos?.nombre}? ${a.estado === 'validada' ? 'Su destajo también se cancelará.' : ''}`)
                    if (r !== undefined) { setError(r); cargar(); onCambio?.() }
                  }}><XCircle className="h-3.5 w-3.5" /> Anular</button>}
                </div>
              </div>
            )
          })}
          <p className="text-right text-xs text-slate-500">Destajo total de las actividades mostradas: <b>{money2(total)}</b></p>
        </div>
      )}
      {terminar && <Terminar a={terminar} onClose={() => setTerminar(null)} onOk={() => { setTerminar(null); cargar(); onCambio?.() }} />}
      {verEv && <Evidencia a={verEv} onClose={() => setVerEv(null)} />}
      {nueva && <Modal title="Asignar trabajo" onClose={() => setNueva(false)}><NuevaActividad ordenId={ordenId} onDone={() => { setNueva(false); cargar(); onCambio?.() }} /></Modal>}
    </div>
  )
}
