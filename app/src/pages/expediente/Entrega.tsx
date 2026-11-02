import { useState } from 'react'
import { CheckCircle2, Star, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { ETAPAS, errorTexto, fechaHora } from '../../lib/format'
import { Card, ErrorMsg, Field, OkMsg } from '../../components/ui'
import { Galeria } from '../../components/Fotos'
import type { TabProps } from './Expediente'

export const CHECKLIST_CALIDAD = [
  'Trabajos del presupuesto completos', 'Color y textura igualados', 'Sin escurrimientos ni polvo en pintura', 'Ajuste de piezas y claros',
  'Luces y eléctrico funcionando', 'Limpieza interior y exterior', 'Objetos del cliente devueltos', 'Prueba de manejo realizada',
]

export default function Entrega({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [check, setCheck] = useState<Record<string, boolean>>(o.checklist_calidad && Object.keys(o.checklist_calidad).length ? o.checklist_calidad : Object.fromEntries(CHECKLIST_CALIDAD.map(c => [c, false])))
  const [recibe, setRecibe] = useState('')
  const [just, setJust] = useState('')
  const [enc, setEnc] = useState({ satisfaccion: o.satisfaccion ?? 0, comentario: o.encuesta_comentario ?? '' })
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const entregado = o.etapa === 'entregado'
  const completo = Object.values(check).every(Boolean)

  async function entregar() {
    if (!recibe.trim()) return setError('Indica el nombre de quien recibe el vehículo')
    if (!completo && !confirm('El checklist de calidad no está completo. ¿Entregar de todas formas?')) return
    if (!confirm(`¿Confirmas la entrega de ${o.folio} a ${recibe}? La orden quedará cerrada.`)) return
    const { error } = await supabase.rpc('orden_entregar', { p_orden: o.id, p_recibe: recibe, p_checklist: check, p_justificacion: just || null })
    if (error) return setError(errorTexto(error))
    setError(null); recargar()
  }
  async function guardarEncuesta() {
    if (!enc.satisfaccion) return setError('Selecciona una calificación')
    const { error } = await supabase.from('ordenes').update({ satisfaccion: enc.satisfaccion, encuesta_comentario: enc.comentario || null, encuesta_fecha: new Date().toISOString() }).eq('id', o.id)
    if (error) return setError(errorTexto(error))
    setError(null); setOk('Encuesta registrada'); recargar()
  }

  if (o.etapa === 'cancelado') return <Card><p className="text-sm text-slate-500">La orden fue cancelada. El expediente se conserva.</p></Card>
  return (
    <div className="space-y-5">
      <ErrorMsg error={error} /><OkMsg msg={ok} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Checklist final de calidad">
          <ul className="space-y-1.5">
            {Object.keys(check).map(c => (
              <li key={c}><label className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" className="h-5 w-5" checked={check[c]} disabled={entregado} onChange={e => setCheck({ ...check, [c]: e.target.checked })} />{c}
              </label></li>
            ))}
          </ul>
        </Card>
        <Card title="Fotografías del trabajo terminado">
          <Galeria ordenId={o.id} categoria="entrega" />
          <div className="mt-5 text-sm font-semibold">Evidencia de conformidad (firma, hoja de entrega)</div>
          <div className="mt-2"><Galeria ordenId={o.id} categoria="conformidad" /></div>
        </Card>
      </div>

      {!entregado ? (
        puede('ordenes.gestionar') && (
          <Card title="Registrar entrega">
            {o.etapa !== 'listo_entrega' && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">La orden está en “{ETAPAS[o.etapa].label}”. Solo se entrega en “Listo para entrega”; de lo contrario se requiere una excepción con justificación.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de quien recibe *"><input className="input" value={recibe} onChange={e => setRecibe(e.target.value)} /></Field>
              {o.etapa !== 'listo_entrega' && <Field label="Justificación de la excepción"><input className="input" value={just} onChange={e => setJust(e.target.value)} /></Field>}
            </div>
            <div className="mt-4 text-sm text-slate-500">Fecha de terminación: {fechaHora(o.fecha_terminacion)}. La fecha real de entrega se registra automáticamente.</div>
            <button className="btn btn-success mt-4 w-full sm:w-auto" onClick={entregar}><Truck className="h-5 w-5" /> Entregar vehículo</button>
          </Card>
        )
      ) : (
        <Card title={<span className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" /> Vehículo entregado</span>}>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Terminación</dt><dd className="font-semibold">{fechaHora(o.fecha_terminacion)}</dd></div>
            <div><dt className="text-xs text-slate-500">Entrega</dt><dd className="font-semibold">{fechaHora(o.fecha_entrega)}</dd></div>
            <div><dt className="text-xs text-slate-500">Recibió</dt><dd className="font-semibold">{o.recibio_nombre}</dd></div>
            <div><dt className="text-xs text-slate-500">Dentro del plazo</dt><dd className={`font-semibold ${o.entregado_a_tiempo ? 'text-green-700' : 'text-red-600'}`}>{o.entregado_a_tiempo ? 'Sí' : 'No'}</dd></div>
          </dl>
        </Card>
      )}

      {entregado && (
        <Card title="Encuesta de satisfacción">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" disabled={!puede('ordenes.gestionar')} onClick={() => setEnc({ ...enc, satisfaccion: n })} aria-label={`${n} estrellas`}>
                <Star className={`h-9 w-9 ${n <= enc.satisfaccion ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <Field label="Comentarios del cliente" className="mt-3"><textarea className="input" rows={2} value={enc.comentario} disabled={!puede('ordenes.gestionar')} onChange={e => setEnc({ ...enc, comentario: e.target.value })} /></Field>
          {o.encuesta_fecha && <p className="mt-1 text-xs text-slate-400">Registrada {fechaHora(o.encuesta_fecha)}</p>}
          {puede('ordenes.gestionar') && <button className="btn btn-primary mt-3" onClick={guardarEncuesta}>Guardar encuesta</button>}
        </Card>
      )}
    </div>
  )
}
