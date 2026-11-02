import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, PackageCheck, Plus, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { revertir } from '../lib/revertir'
import { useAuth } from '../lib/auth'
import { useAlertas } from '../lib/alertas'
import { ESTADO_SOLICITUD, TIPOS_MATERIAL, errorTexto, fechaHora, money2, num } from '../lib/format'
import type { Material } from '../lib/tipos'
import { Badge, Empty, ErrorMsg, Field, Modal } from './ui'

interface Solicitud {
  id: number; orden_id: number | null; centro_costo: string | null; material_id: number; cantidad_solicitada: number
  cantidad_aprobada: number | null; cantidad_entregada: number | null; costo_unit: number | null; costo_total: number | null
  estado: string; notas: string | null; motivo_rechazo: string | null; solicitado_at: string; entregado_at: string | null
  materiales?: { codigo: string | null; descripcion: string; unidad: string; tipo: string; existencia: number }
  ordenes?: { folio: string } | null
  solicitante?: { nombre: string } | null; entrego?: { nombre: string } | null
}

export function NuevaSolicitud({ ordenId, onDone }: { ordenId?: number; onDone: () => void }) {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [ordenes, setOrdenes] = useState<{ id: number; folio: string; marca: string; modelo: string }[]>([])
  const [destino, setDestino] = useState<'orden' | 'general'>('orden')
  const [f, setF] = useState({ orden_id: ordenId ? String(ordenId) : '', centro_costo: '', material_id: '', cantidad: '', notas: '' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('materiales').select('*').eq('activo', true).order('descripcion').then(({ data }) => setMateriales((data ?? []) as Material[]))
    if (!ordenId) supabase.from('v_ordenes').select('id,folio,marca,modelo').not('etapa', 'in', '(entregado,cancelado)').order('folio').then(({ data }) => setOrdenes(data ?? []))
  }, [ordenId])
  const mat = materiales.find(m => String(m.id) === f.material_id)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('solicitudes_material').insert({
      orden_id: destino === 'orden' ? Number(f.orden_id) : null, centro_costo: destino === 'general' ? f.centro_costo.trim() : null,
      material_id: Number(f.material_id), cantidad_solicitada: Number(f.cantidad), notas: f.notas || null,
    })
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
      {!ordenId && (<>
        <div className="flex gap-2 sm:col-span-2">
          {(['orden', 'general'] as const).map(d => (
            <button key={d} type="button" onClick={() => setDestino(d)} className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${destino === d ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'}`}>
              {d === 'orden' ? 'Para una orden de trabajo' : 'Consumo general autorizado'}
            </button>
          ))}
        </div>
        {destino === 'orden'
          ? <Field label="Orden *" className="sm:col-span-2"><select className="input" required value={f.orden_id} onChange={e => setF({ ...f, orden_id: e.target.value })}><option value="">Selecciona…</option>{ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.marca} {o.modelo}</option>)}</select></Field>
          : <Field label="Centro de costo *" className="sm:col-span-2" hint="Ej. Limpieza de cabina, mantenimiento de equipo"><input className="input" required value={f.centro_costo} onChange={e => setF({ ...f, centro_costo: e.target.value })} /></Field>}
      </>)}
      <Field label="Material *" className="sm:col-span-2">
        <select className="input" required value={f.material_id} onChange={e => setF({ ...f, material_id: e.target.value })}>
          <option value="">Selecciona…</option>
          {Object.entries(TIPOS_MATERIAL).map(([k, v]) => (
            <optgroup key={k} label={v}>{materiales.filter(m => m.tipo === k).map(m => <option key={m.id} value={m.id}>{m.codigo ? `[${m.codigo}] ` : ''}{m.descripcion} — exist. {num(m.existencia, 3)} {m.unidad}</option>)}</optgroup>
          ))}
        </select>
      </Field>
      <Field label={`Cantidad *${mat ? ` (${mat.unidad})` : ''}`}><input className="input" type="number" step="0.001" min="0.001" required value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} /></Field>
      <Field label="Notas"><input className="input" value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      {mat && Number(f.cantidad) > Number(mat.existencia) && <p className="text-xs text-amber-700 sm:col-span-2">La existencia actual ({num(mat.existencia, 3)} {mat.unidad}) es menor a lo solicitado; almacén no podrá entregar hasta recibir compra.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn btn-primary">Enviar solicitud</button>
      </div>
    </form>
  )
}

/** Flujo: técnico solicita → supervisor autoriza → almacén entrega → se descuenta existencia y se carga el costo a la orden */
export default function Solicitudes({ ordenId, filtroEstado = 'todas', cerrada, abrirNueva, onCambio }: {
  ordenId?: number; filtroEstado?: string; cerrada?: boolean; abrirNueva?: boolean; onCambio?: () => void
}) {
  const { puede } = useAuth()
  const al = useAlertas()
  const [rows, setRows] = useState<Solicitud[]>([])
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState(!!abrirNueva)

  const cargar = useCallback(async () => {
    let q = supabase.from('solicitudes_material')
      .select('*, materiales(codigo,descripcion,unidad,tipo,existencia), ordenes(folio), solicitante:perfiles!solicitudes_material_solicitado_por_fkey(nombre), entrego:perfiles!solicitudes_material_entregado_por_fkey(nombre)')
      .order('solicitado_at', { ascending: false }).limit(500)
    if (ordenId) q = q.eq('orden_id', ordenId)
    if (filtroEstado !== 'todas') q = q.eq('estado', filtroEstado)
    const { data, error } = await q
    if (error) setError(errorTexto(error))
    setRows((data ?? []) as Solicitud[])
  }, [ordenId, filtroEstado])
  useEffect(() => { cargar() }, [cargar])

  async function rpc(fn: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(fn, args)
    setError(error ? errorTexto(error) : null)
    cargar(); al.recargar(); onCambio?.()
  }
  function autorizar(s: Solicitud) {
    const c = prompt(`Cantidad a autorizar (${s.materiales?.unidad}):`, String(s.cantidad_solicitada))
    if (c === null) return
    rpc('solicitud_resolver', { p_id: s.id, p_aprobar: true, p_cantidad: Number(c) })
  }
  function rechazar(s: Solicitud) {
    const m = prompt('Motivo del rechazo:')
    if (m) rpc('solicitud_resolver', { p_id: s.id, p_aprobar: false, p_motivo: m })
  }
  function entregar(s: Solicitud) {
    const c = prompt(`Cantidad entregada (${s.materiales?.unidad}). Autorizado: ${num(s.cantidad_aprobada, 3)}`, String(s.cantidad_aprobada))
    if (c === null) return
    if (confirm(`Se descontarán ${c} ${s.materiales?.unidad} del inventario y su costo se cargará a ${s.ordenes?.folio ?? s.centro_costo}. ¿Continuar?`))
      rpc('solicitud_entregar', { p_id: s.id, p_cantidad: Number(c) })
  }

  const totalCargado = rows.filter(r => r.estado === 'entregada').reduce((s, r) => s + Number(r.costo_total ?? 0), 0)

  return (
    <div>
      <ErrorMsg error={error} />
      {!cerrada && puede('materiales.solicitar') && (
        <div className="mb-3 flex justify-end"><button className="btn btn-primary" onClick={() => setNueva(true)}><Plus className="h-4 w-4" /> Solicitar material</button></div>
      )}
      {rows.length === 0 ? <Empty>Sin solicitudes de material</Empty> : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Material</th>{!ordenId && <th>Destino</th>}<th className="text-right">Solicitado</th><th className="text-right">Autorizado</th><th className="text-right">Entregado</th><th className="text-right">Costo</th><th>Estado</th><th></th></tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.id}>
                <td className="text-xs whitespace-nowrap">{fechaHora(s.solicitado_at)}<div className="text-slate-400">{s.solicitante?.nombre}</div></td>
                <td><div className="font-medium">{s.materiales?.descripcion}</div><div className="text-xs text-slate-500">{TIPOS_MATERIAL[s.materiales?.tipo ?? '']}{s.notas && ` · ${s.notas}`}</div></td>
                {!ordenId && <td>{s.orden_id ? <Link className="font-semibold text-blue-600 hover:underline" to={`/ordenes/${s.orden_id}?tab=materiales`}>{s.ordenes?.folio}</Link> : <span className="text-xs">General: {s.centro_costo}</span>}</td>}
                <td className="text-right">{num(s.cantidad_solicitada, 3)} {s.materiales?.unidad}</td>
                <td className="text-right">{s.cantidad_aprobada != null ? num(s.cantidad_aprobada, 3) : '—'}</td>
                <td className="text-right">{s.cantidad_entregada != null ? num(s.cantidad_entregada, 3) : '—'}{s.entrego && <div className="text-[11px] text-slate-400">{s.entrego.nombre}</div>}</td>
                <td className="text-right">{s.costo_total != null ? money2(s.costo_total) : '—'}</td>
                <td><Badge cls={ESTADO_SOLICITUD[s.estado].badge}>{ESTADO_SOLICITUD[s.estado].label}</Badge>{s.motivo_rechazo && <div className="text-[11px] text-red-600">{s.motivo_rechazo}</div>}</td>
                <td className="whitespace-nowrap text-right">
                  {s.estado === 'solicitada' && puede('materiales.autorizar') && <>
                    <button className="btn btn-success btn-sm" onClick={() => autorizar(s)} title="Autorizar"><CheckCircle2 className="h-3.5 w-3.5" /> Autorizar</button>{' '}
                    <button className="btn btn-ghost btn-sm text-red-600" onClick={() => rechazar(s)} title="Rechazar"><XCircle className="h-4 w-4" /></button>
                  </>}
                  {s.estado === 'autorizada' && puede('almacen.gestionar') && <button className="btn btn-primary btn-sm" onClick={() => entregar(s)}><PackageCheck className="h-3.5 w-3.5" /> Entregar</button>}
                  {s.estado === 'entregada' && (puede('almacen.gestionar') || puede('excepciones.autorizar')) && <button className="btn btn-ghost btn-sm text-red-600" title="Devolver al almacén" onClick={async () => {
                    const r = await revertir('solicitud_devolver', { p_id: s.id }, `¿Devolver ${num(s.cantidad_entregada, 3)} ${s.materiales?.unidad} de ${s.materiales?.descripcion} al almacén? Se regresa la existencia y se retira el costo de ${s.ordenes?.folio ?? 'la orden'}.`)
                    if (r !== undefined) { setError(r); cargar(); al.recargar(); onCambio?.() }
                  }}>Devolver</button>}
                </td>
              </tr>))}
            </tbody>
          </table>
          {ordenId && <p className="mt-2 text-right text-sm">Costo de materiales cargado a la orden: <b>{money2(totalCargado)}</b></p>}
        </div>
      )}
      {nueva && <Modal title="Solicitud de material" onClose={() => setNueva(false)}><NuevaSolicitud ordenId={ordenId} onDone={() => { setNueva(false); cargar(); al.recargar(); onCambio?.() }} /></Modal>}
    </div>
  )
}
