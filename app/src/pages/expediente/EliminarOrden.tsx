import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { errorTexto } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { ErrorMsg, Field, Modal } from '../../components/ui'

const DONDE: Record<string, { tab: string; como: string }> = {
  'destajos generados': { tab: 'costos', como: 'Costos y destajos → “Cancelar” en cada destajo (o anula el trabajo)' },
  'trabajos terminados o validados': { tab: 'trabajos', como: 'Trabajos y avance → “Anular” en cada trabajo (cancela también su destajo)' },
  'material entregado del almacén': { tab: 'materiales', como: 'Materiales y compras → “Devolver” en cada entrega (regresa la existencia)' },
  'facturas vigentes': { tab: 'costos', como: 'Costos y destajos → Facturas → “Cancelar”' },
  'cobros': { tab: 'costos', como: 'Costos y destajos → Cobros → “Eliminar”' },
  'otros costos registrados': { tab: 'costos', como: 'Costos y destajos → Otros costos → “Eliminar”' },
}

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
          <ul className="space-y-2">{bloqueos.map(b => { const d = DONDE[b]; return (
            <li key={b} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
              <span><b className="text-red-700">{b}</b>{d && <span className="block text-xs text-slate-600">{d.como}</span>}</span>
              {d && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onClose(); nav(`/ordenes/${o.id}?tab=${d.tab}`) }}>Ir a revertir</button>}
            </li>) })}
          </ul>
          <p className="text-slate-600">Cuando reviertas esos movimientos podrás eliminar la orden. Si prefieres conservar su historial, <b>cancélala</b> desde <i>Información general → Avance de etapa → Cancelado</i>.</p>
          <div className="flex justify-end"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
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
