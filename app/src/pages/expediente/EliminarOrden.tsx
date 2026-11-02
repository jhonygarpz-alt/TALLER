import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { errorTexto } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { ErrorMsg, Field, Modal } from '../../components/ui'

/** Eliminación controlada: solo órdenes sin movimientos económicos, con motivo y confirmación por folio */
export default function EliminarOrden({ o, onClose }: { o: VOrden; onClose: () => void }) {
  const nav = useNavigate()
  const al = useAlertas()
  const [bloqueos, setBloqueos] = useState<string[] | null>(null)
  const [motivo, setMotivo] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.rpc('orden_bloqueos_eliminar', { p_orden: o.id }).then(({ data, error }) => {
      if (error) setError(errorTexto(error))
      setBloqueos((data as string[] | null) ?? [])
    })
  }, [o.id])

  async function eliminar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setError(null)
    const { data, error } = await supabase.rpc('orden_eliminar', { p_orden: o.id, p_motivo: motivo })
    if (error) { setEnviando(false); return setError(errorTexto(error)) }
    const fotos = (data as string[] | null) ?? []
    if (fotos.length) await supabase.storage.from('evidencias').remove(fotos)  // limpieza de archivos (solo Dirección tiene permiso)
    al.recargar()
    nav('/ordenes', { replace: true })
  }

  return (
    <Modal title={`Eliminar orden ${o.folio}`} onClose={onClose}>
      <ErrorMsg error={error} />
      {bloqueos === null ? <p className="text-sm text-slate-400">Revisando movimientos de la orden…</p> : bloqueos.length > 0 ? (
        <div className="space-y-3 text-sm">
          <p>Esta orden <b>no se puede eliminar</b> porque ya tiene movimientos que forman parte de los costos y la contabilidad del taller:</p>
          <ul className="list-disc space-y-1 pl-5 text-red-700">{bloqueos.map(b => <li key={b}>{b}</li>)}</ul>
          <p className="text-slate-600">Si la orden no procede, <b>cancélala</b> desde <i>Información general → Avance de etapa → Cancelado</i>. Así se conserva su historial y no se pierden costos.</p>
          <div className="flex justify-end"><button className="btn btn-secondary" onClick={onClose}>Entendido</button></div>
        </div>
      ) : (
        <form onSubmit={eliminar} className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Se eliminarán la orden <b>{o.folio}</b> ({o.marca} {o.modelo} {o.placas}) con sus fotografías, daños, presupuestos y trabajos sin terminar. El cliente y el vehículo se conservan.
            {o.asignacion_id && ' La asignación de aseguradora quedará disponible para volver a recibir el vehículo.'}
            {' '}Se guardará una copia completa en Auditoría.
          </div>
          <Field label="Motivo de la eliminación *"><input className="input" required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Orden duplicada / capturada por error" /></Field>
          <Field label={`Para confirmar escribe el folio: ${o.folio}`}><input className="input font-mono" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-danger" disabled={enviando || !motivo.trim() || confirmacion.trim().toUpperCase() !== o.folio}><Trash2 className="h-4 w-4" /> {enviando ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
