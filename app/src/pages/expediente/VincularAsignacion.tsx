import { useState } from 'react'
import { AlertTriangle, Link2, Loader2, PlusCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { errorTexto } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { ErrorMsg, Modal } from '../../components/ui'
import { SelectorAsignacion, type AsignacionSel } from '../../components/SelectorAsignacion'

/** Aviso para órdenes de aseguradora sin asignación (creadas antes de la regla) y vinculación */
export default function VincularAsignacion({ o, recargar }: { o: VOrden; recargar: () => void }) {
  const { puede } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState<AsignacionSel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  if (o.tipo !== 'aseguradora' || o.asignacion_id) return null

  async function vincular(asig: number | null) {
    setGuardando(true); setError(null)
    const { error } = await supabase.rpc('orden_vincular_asignacion', { p_orden: o.id, p_asignacion: asig })
    setGuardando(false)
    if (error) return setError(errorTexto(error))
    setAbierto(false); recargar()
  }

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_0_12px_rgba(245,158,11,.25)]">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span className="flex-1"><b>Esta orden de aseguradora no está ligada a una asignación.</b> Vincúlala para que cuente en los indicadores de asignaciones de {o.aseguradora_nombre}.</span>
        {puede('ordenes.gestionar') && <button className="btn btn-warning btn-sm" onClick={() => setAbierto(true)}><Link2 className="h-4 w-4" /> Vincular asignación</button>}
      </div>
      {abierto && (
        <Modal title={`Vincular asignación · ${o.folio}`} onClose={() => setAbierto(false)}>
          <div className="space-y-4">
            <ErrorMsg error={error} />
            <p className="text-sm text-slate-600">Elige la asignación de {o.aseguradora_nombre} que corresponde a este vehículo ({o.marca} {o.modelo} {o.placas ?? ''}).</p>
            <SelectorAsignacion aseguradoraId={String(o.aseguradora_id)} seleccion={sel} nueva={false} onElegir={setSel} onNueva={() => { if (confirm('¿Crear la asignación con los datos de esta orden?')) vincular(null) }} />
            {sel && <button className="btn btn-primary w-full" disabled={guardando} onClick={() => vincular(sel.id)}>{guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Vincular siniestro {sel.siniestro}</button>}
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="mb-2 text-slate-600">¿No existe en la lista? Se puede crear la asignación con los datos de la orden{o.siniestro ? <> (siniestro <b>{o.siniestro}</b>)</> : ''}.</div>
              <button className="btn btn-secondary btn-sm" disabled={guardando || !o.siniestro} onClick={() => vincular(null)}><PlusCircle className="h-4 w-4" /> Crear asignación con los datos de la orden</button>
              {!o.siniestro && <div className="mt-1 text-xs text-red-600">La orden no tiene siniestro: captúralo con “Editar” primero.</div>}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
