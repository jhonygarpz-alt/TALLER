import { useEffect, useState } from 'react'
import { ArrowRight, History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ETAPAS, ETAPAS_TABLERO, errorTexto, fecha, fechaHora, type Etapa } from '../../lib/format'
import { Badge, Card, ErrorMsg, Field } from '../../components/ui'
import { Galeria } from '../../components/Fotos'
import type { TabProps } from './Expediente'

interface Hist { id: number; fecha: string; etapa_anterior: Etapa | null; etapa_nueva: Etapa; excepcion: boolean; justificacion: string | null; perfiles?: { nombre: string } | null }

export function CambioEtapa({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [etapa, setEtapa] = useState<Etapa | ''>('')
  const [just, setJust] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  if (cerrada || !puede('ordenes.etapa')) return null
  const opciones = [...ETAPAS_TABLERO.filter(e => e !== 'entregado' && e !== o.etapa), ...(puede('excepciones.autorizar') ? ['cancelado' as Etapa] : [])]

  async function cambiar() {
    if (!etapa) return
    if (!confirm(`¿Cambiar la orden ${o.folio} a "${ETAPAS[etapa].label}"?`)) return
    setEnviando(true); setError(null)
    const { error } = await supabase.rpc('orden_cambiar_etapa', { p_orden: o.id, p_etapa: etapa, p_justificacion: just || null })
    setEnviando(false)
    if (error) return setError(errorTexto(error))
    setEtapa(''); setJust(''); recargar()
  }

  return (
    <Card title="Avance de etapa">
      <ErrorMsg error={error} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="text-sm"><span className="text-slate-500">Actual:</span> <Badge cls={ETAPAS[o.etapa].badge}>{ETAPAS[o.etapa].label}</Badge></div>
        <ArrowRight className="mb-1 h-4 w-4 text-slate-400" />
        <select className="input w-auto" value={etapa} onChange={e => setEtapa(e.target.value as Etapa)}>
          <option value="">Mover a…</option>
          {opciones.map(e => <option key={e} value={e}>{ETAPAS[e].label}</option>)}
        </select>
        <button className="btn btn-primary" disabled={!etapa || enviando} onClick={cambiar}>Cambiar etapa</button>
      </div>
      {etapa && (
        <Field label="Justificación (obligatoria para excepciones y cancelaciones)" className="mt-3">
          <input className="input" value={just} onChange={e => setJust(e.target.value)} placeholder="Ej. Autorización verbal del ajustador, se formaliza mañana" />
        </Field>
      )}
      <p className="mt-2 text-xs text-slate-500">Las etapas de reparación requieren presupuesto autorizado; “Listo para entrega” requiere todos los trabajos validados. Las excepciones quedan registradas con usuario y justificación.</p>
    </Card>
  )
}

export default function General(props: TabProps) {
  const { o, recargar } = props
  const { puede } = useAuth()
  const [hist, setHist] = useState<Hist[]>([])
  const [motivo, setMotivo] = useState(o.motivo_retraso ?? '')
  const [error, setError] = useState<string | null>(null)
  const puedeEditar = puede('ordenes.gestionar') || puede('actividades.asignar')
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'

  useEffect(() => {
    supabase.from('orden_historial').select('*, perfiles(nombre)').eq('orden_id', o.id).order('fecha', { ascending: false })
      .then(({ data }) => setHist((data ?? []) as Hist[]))
  }, [o.id, o.etapa])

  async function actualizar(campos: Record<string, unknown>) {
    const { error } = await supabase.from('ordenes').update(campos).eq('id', o.id)
    setError(error ? errorTexto(error) : null)
    if (!error) recargar()
  }

  const checklist = Object.entries(o.checklist_recepcion ?? {})
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <CambioEtapa {...props} />
        <Card title="Datos de la orden">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['Tipo de servicio', o.tipo === 'aseguradora' ? `Aseguradora · ${o.aseguradora_nombre}` : 'Particular'],
              ['Siniestro', o.siniestro ?? '—'], ['Tipo de reparación', o.tipo_reparacion_nombre ?? '—'],
              ['Asesor responsable', o.asesor_nombre ?? '—'], ['Técnicos con trabajos activos', o.tecnicos_activos ?? '—'],
              ['Fecha y hora de ingreso', fechaHora(o.fecha_ingreso)], ['Fecha compromiso', fecha(o.fecha_compromiso)],
              ['Kilometraje', o.kilometraje != null ? `${o.kilometraje.toLocaleString('es-MX')} km` : '—'],
              ['Propietario', `${o.cliente_nombre}${o.cliente_telefono ? ' · ' + o.cliente_telefono : ''}`],
              ['Vehículo', `${o.marca} ${o.modelo} ${o.anio ?? ''} · ${o.color ?? ''}`],
            ].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          <div className="mt-4 text-sm"><div className="text-xs text-slate-500">Daños reportados</div><p className="whitespace-pre-wrap">{o.danos_reportados ?? '—'}</p></div>
          {o.objetos && <div className="mt-3 text-sm"><div className="text-xs text-slate-500">Objetos y accesorios</div><p className="whitespace-pre-wrap">{o.objetos}</p></div>}
        </Card>

        <Card title="Seguimiento y retrasos">
          <ErrorMsg error={error} />
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={o.detenido_material} disabled={!puedeEditar || cerrada}
              onChange={e => actualizar({ detenido_material: e.target.checked })} />
            <span><b>Detenido por falta de materiales</b> <span className="text-slate-500">(genera alerta en el tablero)</span></span>
          </label>
          <div className="mt-3 flex gap-2">
            <input className="input" placeholder="Motivo de retraso (si aplica)" value={motivo} disabled={!puedeEditar} onChange={e => setMotivo(e.target.value)} />
            {puedeEditar && motivo !== (o.motivo_retraso ?? '') && <button className="btn btn-primary" onClick={() => actualizar({ motivo_retraso: motivo || null })}>Guardar</button>}
          </div>
          <p className="mt-2 text-xs text-slate-400">Última actualización de avance: {fechaHora(o.ultima_actualizacion)}</p>
        </Card>

        <Card title="Fotografías de recepción">
          <Galeria ordenId={o.id} categoria="recepcion" puedeSubir={!cerrada} onCambio={recargar} />
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Checklist de recepción">
          {checklist.length === 0 ? <p className="text-sm text-slate-400">Sin checklist</p> : (
            <ul className="space-y-1 text-sm">
              {checklist.map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className={v === 'danado' ? 'font-semibold text-red-600' : v === 'no_tiene' ? 'text-slate-400' : 'text-green-700'}>
                    {v === 'bien' ? 'Bien' : v === 'danado' ? 'Dañado' : v === 'no_tiene' ? 'No tiene' : v}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4" /> Historial de etapas</span>}>
          <ol className="space-y-3 border-l-2 border-slate-200 pl-4 text-sm">
            {hist.map(h => (
              <li key={h.id}>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge cls={ETAPAS[h.etapa_nueva].badge}>{ETAPAS[h.etapa_nueva].label}</Badge>
                  {h.excepcion && <Badge cls="bg-red-600 text-white">Excepción</Badge>}
                </div>
                <div className="text-xs text-slate-500">{fechaHora(h.fecha)} · {h.perfiles?.nombre ?? 'Sistema'}</div>
                {h.justificacion && <div className="text-xs text-slate-600">{h.justificacion}</div>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}
