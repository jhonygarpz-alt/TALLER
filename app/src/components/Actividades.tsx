import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Pencil, Play, Plus, RotateCcw, Square, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { revertir } from '../lib/revertir'
import { useAuth } from '../lib/auth'
import { AREAS, ESTADO_ACTIVIDAD, errorTexto, fechaHora, money2, num } from '../lib/format'
import type { Tarifa, Tecnico } from '../lib/tipos'
import { Badge, Empty, ErrorMsg, Field, Modal } from './ui'
import { Galeria } from './Fotos'

export const responsable = (a: Pick<Actividad, 'tecnicos' | 'proveedores'>) => a.tecnicos?.nombre ?? a.proveedores?.nombre?.trim() ?? '—'

export interface Actividad {
  id: number; orden_id: number; area: string; actividad: string; pieza: string | null; tecnico_id: number | null; proveedor_id: number | null; costo_proveedor: number | null; tarifa_id: number | null
  importe_destajo: number; estado: string; fecha_asignacion: string; fecha_inicio: string | null; fecha_fin: string | null
  horas: number | null; rechazos: number; motivo_rechazo: string | null; validado_at: string | null
  tecnicos?: { nombre: string; perfil_id: string | null } | null; proveedores?: { nombre: string } | null; ordenes?: { folio: string; etapa: string; tipo: string }
}

/** Tiempo trabajado en piezas: media pieza y de 1 hasta 12, en medias */
const OPCIONES_PIEZAS = Array.from({ length: 24 }, (_, i) => (i + 1) / 2)
export const piezasTxt = (n: number) => {
  const e = Math.floor(n), media = n - e >= 0.5
  if (e === 0) return '½ pieza'
  return `${e}${media ? '½' : ''} ${e === 1 && !media ? 'pieza' : 'piezas'}`
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
      <Field label="2. Tiempo trabajado (horas en piezas)" hint="Media pieza y de 1 hasta 12 piezas. Si no eliges, se calcula desde el inicio." className="mt-4">
        <select className="input" value={horas} onChange={e => setHoras(e.target.value)}>
          <option value="">Calcular desde el inicio</option>
          {OPCIONES_PIEZAS.map(n => <option key={n} value={n}>{piezasTxt(n)}</option>)}
        </select>
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
  const [proveedores, setProveedores] = useState<{ id: number; nombre: string }[]>([])
  const [f, setF] = useState({ orden_id: ordenId ? String(ordenId) : '', tarifa_id: '', area: 'hojalateria', actividad: '', pieza: '', tecnico_id: '', proveedor_id: '', costo: '' })
  const [externo, setExterno] = useState(false)
  const [otroImporte, setOtroImporte] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('tarifas_destajo').select('*').eq('activo', true).order('area').order('importe').order('actividad').then(({ data }) => setTarifas((data ?? []) as Tarifa[]))
    supabase.from('tecnicos').select('*').eq('activo', true).order('nombre').then(({ data }) => setTecnicos((data ?? []) as Tecnico[]))
    supabase.from('proveedores').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => setProveedores(data ?? []))
    if (!ordenId) supabase.from('v_ordenes').select('id,folio,marca,modelo,placas').not('etapa', 'in', '(entregado,cancelado)').order('folio').then(({ data }) => setOrdenes(data ?? []))
  }, [ordenId])
  const tarifa = tarifas.find(t => String(t.id) === f.tarifa_id)
  const importesConcepto = [...new Set(tarifas.filter(t => /^concepto/i.test(t.actividad.trim())).map(t => Number(t.importe)))].sort((a, b) => a - b)
  const tecs = tecnicos.filter(t => !tarifa || t.area === tarifa.area || true)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (externo) {
      if (!f.proveedor_id) return setError('Elige el proveedor que hará el servicio')
      if (!(Number(f.costo) > 0)) return setError('Elige el importe por concepto')
    } else {
      if (!tarifa && !f.actividad.trim()) return setError('Elige una tarifa o describe la actividad')
      if (!f.tecnico_id) return setError('Elige el técnico responsable')
    }
    const t = externo ? undefined : tarifa
    const { error } = await supabase.from('actividades').insert({
      orden_id: Number(f.orden_id), tarifa_id: t ? t.id : null, area: t?.area ?? f.area,
      actividad: f.actividad.trim() || t?.actividad || (externo ? `CONCEPTO ${money2(Number(f.costo))}` : undefined), pieza: f.pieza || null,
      tecnico_id: externo ? null : Number(f.tecnico_id), proveedor_id: externo ? Number(f.proveedor_id) : null,
      costo_proveedor: externo ? Number(f.costo) : null,
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
      <Field grupo label="¿Quién hará el trabajo?" className="sm:col-span-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {([[false, 'Técnico del taller'], [true, 'Proveedor externo']] as const).map(([v, l]) => (
            <button key={l} type="button" onClick={() => setExterno(v)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${externo === v ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </Field>
      {externo ? <>
        <Field label="Proveedor *" className="sm:col-span-2" hint={proveedores.length === 0 ? 'No hay proveedores. Agrégalos en Compras → Proveedores.' : undefined}>
          <select className="input" value={f.proveedor_id} onChange={e => setF({ ...f, proveedor_id: e.target.value })}>
            <option value="">Selecciona…</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre.trim()}</option>)}
          </select>
        </Field>
        <Field label="Descripción del servicio" className="sm:col-span-2"><input className="input" value={f.actividad} onChange={e => setF({ ...f, actividad: e.target.value })} placeholder="Ej. Reparación de rin, alineación, cristal…" /></Field>
        <Field label="Área"><select className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Pieza"><input className="input" value={f.pieza} onChange={e => setF({ ...f, pieza: e.target.value })} placeholder="Ej. Rin delantero derecho" /></Field>
        <Field label="Importe por concepto *" className={otroImporte ? '' : 'sm:col-span-2'} hint="Pago por servicio: no genera destajo. Al validar el trabajo se registra como servicio externo en los costos de la orden.">
          <select className="input" value={otroImporte ? 'otro' : f.costo} onChange={e => { const v = e.target.value; setOtroImporte(v === 'otro'); setF({ ...f, costo: v === 'otro' ? '' : v }) }}>
            <option value="">Selecciona…</option>
            {importesConcepto.map(n => <option key={n} value={n}>CONCEPTO {money2(n)}</option>)}
            <option value="otro">Otro importe…</option>
          </select>
        </Field>
        {otroImporte && <Field label="Otro importe *"><input className="input" type="number" min="0" step="0.01" autoFocus value={f.costo} onChange={e => setF({ ...f, costo: e.target.value })} placeholder="0.00" /></Field>}
      </> : <>
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
        <select className="input" value={f.tecnico_id} onChange={e => setF({ ...f, tecnico_id: e.target.value })}>
          <option value="">Selecciona…</option>{tecs.map(t => <option key={t.id} value={t.id}>{t.nombre} ({AREAS[t.area]})</option>)}
        </select>
      </Field>
      </>}
      {!externo && tecnicos.length === 0 && <p className="text-xs text-amber-700 sm:col-span-2">No hay técnicos registrados. Agrégalos en Taller → Técnicos y tarifas.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn btn-primary">Asignar trabajo</button>
      </div>
    </form>
  )
}

/** Editar un trabajo asignado. Terminados o validados: solo descripción, pieza y área (el destajo ya está calculado). */
function EditarActividad({ a, onClose, onOk }: { a: Actividad; onClose: () => void; onOk: () => void }) {
  const abierta = a.estado === 'asignada' || a.estado === 'en_proceso'
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [proveedores, setProveedores] = useState<{ id: number; nombre: string }[]>([])
  const [externo, setExterno] = useState(!!a.proveedor_id)
  const [f, setF] = useState({ actividad: a.actividad, pieza: a.pieza ?? '', area: a.area, tecnico_id: a.tecnico_id ? String(a.tecnico_id) : '', proveedor_id: a.proveedor_id ? String(a.proveedor_id) : '', tarifa_id: a.tarifa_id ? String(a.tarifa_id) : '', costo: a.costo_proveedor != null ? String(a.costo_proveedor) : '' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!abierta) return
    supabase.from('tarifas_destajo').select('*').eq('activo', true).order('area').order('importe').order('actividad').then(({ data }) => setTarifas((data ?? []) as Tarifa[]))
    supabase.from('tecnicos').select('*').eq('activo', true).order('nombre').then(({ data }) => setTecnicos((data ?? []) as Tecnico[]))
    supabase.from('proveedores').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => setProveedores(data ?? []))
  }, [abierta])
  const tarifa = tarifas.find(t => String(t.id) === f.tarifa_id)

  async function guardar(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (!f.actividad.trim()) return setError('Escribe la descripción del trabajo')
    const datos: Record<string, unknown> = { actividad: f.actividad.trim(), pieza: f.pieza.trim() || null, area: f.area }
    if (abierta) {
      if (externo) {
        if (!f.proveedor_id) return setError('Elige el proveedor')
        Object.assign(datos, { tecnico_id: null, proveedor_id: Number(f.proveedor_id), tarifa_id: null, importe_destajo: 0, costo_proveedor: f.costo ? Number(f.costo) : null })
      } else {
        if (!f.tecnico_id) return setError('Elige el técnico')
        Object.assign(datos, { proveedor_id: null, costo_proveedor: null, tecnico_id: Number(f.tecnico_id), tarifa_id: tarifa ? tarifa.id : null, importe_destajo: tarifa ? tarifa.importe : 0 })
      }
    }
    setGuardando(true)
    const { error } = await supabase.from('actividades').update(datos).eq('id', a.id)
    setGuardando(false)
    if (error) return setError(errorTexto(error))
    onOk()
  }
  return (
    <Modal title="Editar trabajo" onClose={onClose}>
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
        {!abierta && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">Este trabajo ya está {a.estado === 'validada' ? 'validado' : 'terminado'}: puedes corregir la descripción, la pieza y el área. El técnico y el destajo ya no cambian; si están mal, anula el trabajo y vuelve a asignarlo.</p>}
        <Field label="Descripción del trabajo *" className="sm:col-span-2"><input className="input" value={f.actividad} onChange={e => setF({ ...f, actividad: e.target.value })} /></Field>
        <Field label="Pieza o piezas" className="sm:col-span-2"><input className="input" value={f.pieza} onChange={e => setF({ ...f, pieza: e.target.value })} /></Field>
        <Field label="Área"><select className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {abierta && <>
          <Field grupo label="¿Quién hace el trabajo?">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {([[false, 'Técnico'], [true, 'Proveedor']] as const).map(([v, l]) => (
                <button key={l} type="button" onClick={() => setExterno(v)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${externo === v ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>{l}</button>
              ))}
            </div>
          </Field>
          {externo ? <>
            <Field label="Proveedor *"><select className="input" value={f.proveedor_id} onChange={e => setF({ ...f, proveedor_id: e.target.value })}><option value="">Selecciona…</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre.trim()}</option>)}</select></Field>
            <Field label="Importe por concepto"><input className="input" type="number" min="0" step="0.01" value={f.costo} onChange={e => setF({ ...f, costo: e.target.value })} /></Field>
          </> : <>
            <Field label="Técnico *"><select className="input" value={f.tecnico_id} onChange={e => setF({ ...f, tecnico_id: e.target.value })}><option value="">Selecciona…</option>{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre.trim()} ({AREAS[t.area]})</option>)}</select></Field>
            <Field label="Tarifa de destajo" hint={tarifa ? `Destajo: ${money2(tarifa.importe)}` : 'Sin tarifa no genera destajo'}>
              <select className="input" value={f.tarifa_id} onChange={e => setF({ ...f, tarifa_id: e.target.value })}>
                <option value="">Sin tarifa</option>
                {Object.entries(AREAS).map(([k, v]) => { const ts = tarifas.filter(t => t.area === k); return ts.length ? <optgroup key={k} label={v}>{ts.map(t => <option key={t.id} value={t.id}>{t.actividad} — {money2(t.importe)}</option>)}</optgroup> : null })}
              </select>
            </Field>
          </>}
        </>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </Modal>
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
  const [editar, setEditar] = useState<Actividad | null>(null)
  const [avances, setAvances] = useState<Record<number, { porcentaje: number; nota: string | null; created_at: string }>>({})

  const cargar = useCallback(async () => {
    let q = supabase.from('actividades').select('*, tecnicos(nombre, perfil_id), proveedores(nombre), ordenes(folio, etapa, tipo)').order('fecha_asignacion', { ascending: false }).limit(500)
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
    if (acc === 'validar' && !confirm(a.proveedor_id
      ? `¿Validar "${a.actividad}" del proveedor ${responsable(a)}? ${Number(a.costo_proveedor) > 0 ? `Se registrará un servicio externo de ${money2(Number(a.costo_proveedor))} en los costos de la orden.` : 'No tiene costo capturado.'}`
      : `¿Validar "${a.actividad}"? Se generará un destajo de ${money2(a.importe_destajo)} para ${a.tecnicos?.nombre}.`)) return
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
                    {AREAS[a.area]} · {a.proveedor_id
                      ? <><Badge cls="bg-violet-100 text-violet-700">Proveedor</Badge> <b>{responsable(a)}</b> · Servicio {Number(a.costo_proveedor) > 0 ? money2(Number(a.costo_proveedor)) : 'sin importe'}</>
                      : <><b>{a.tecnicos?.nombre}</b> · Destajo {a.importe_destajo > 0 ? money2(a.importe_destajo) : 'sin tarifa'}</>}
                    {a.fecha_inicio && ` · Inicio ${fechaHora(a.fecha_inicio)}`}{a.fecha_fin && ` · Fin ${fechaHora(a.fecha_fin)}`}{a.horas != null && ` · ${Number(a.horas) % 0.5 === 0 && Number(a.horas) > 0 && Number(a.horas) <= 12 ? piezasTxt(Number(a.horas)) : `${num(a.horas)} h`}`}
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
                  {a.estado !== 'cancelada' && a.ordenes?.etapa !== 'cancelado' && puede('actividades.asignar') && <button className="btn btn-secondary btn-sm" onClick={() => setEditar(a)}><Pencil className="h-3.5 w-3.5" /> Editar</button>}
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
                    const r = await revertir('actividad_anular', { p_id: a.id }, `¿Anular "${a.actividad}" de ${responsable(a)}? ${a.estado === 'validada' ? (a.proveedor_id ? 'Su costo de servicio externo también se quitará.' : 'Su destajo también se cancelará.') : ''}`)
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
      {editar && <EditarActividad a={editar} onClose={() => setEditar(null)} onOk={() => { setEditar(null); cargar(); onCambio?.() }} />}
      {nueva && <Modal title="Asignar trabajo" onClose={() => setNueva(false)}><NuevaActividad ordenId={ordenId} onDone={() => { setNueva(false); cargar(); onCambio?.() }} /></Modal>}
    </div>
  )
}
