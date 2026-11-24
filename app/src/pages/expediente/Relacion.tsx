import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { errorTexto } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'

/**
 * Relación entre la orden de aseguradora y la orden particular del mismo vehículo.
 * Particular: indica de qué orden de aseguradora es (o "sin relación") y permite cambiarlo.
 * Aseguradora: muestra las órdenes particulares que tiene el mismo vehículo.
 */
export default function Relacion({ o, recargar }: { o: VOrden; recargar: () => void }) {
  const { puede } = useAuth()
  const [opciones, setOpciones] = useState<{ id: number; folio: string }[]>([])
  const [particulares, setParticulares] = useState<{ id: number; folio: string }[]>([])
  useEffect(() => {
    if (o.tipo === 'particular') {
      supabase.from('ordenes').select('id,folio').eq('vehiculo_id', o.vehiculo_id).eq('tipo', 'aseguradora').neq('etapa', 'cancelado').order('fecha_ingreso', { ascending: false })
        .then(({ data }) => setOpciones(data ?? []))
    } else {
      supabase.from('ordenes').select('id,folio').eq('orden_relacionada_id', o.id).neq('etapa', 'cancelado').then(({ data }) => setParticulares(data ?? []))
    }
  }, [o.id, o.tipo, o.vehiculo_id])

  async function cambiar(v: string) {
    const { error } = await supabase.from('ordenes').update({ orden_relacionada_id: v ? Number(v) : null }).eq('id', o.id)
    if (error) return alert(errorTexto(error))
    recargar()
  }

  if (o.tipo === 'aseguradora') {
    if (!particulares.length) return null
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
        <Link2 className="h-3.5 w-3.5" /> Tiene particular: {particulares.map((p, i) => <span key={p.id}>{i > 0 && ', '}<Link className="underline" to={`/ordenes/${p.id}`}>{p.folio}</Link></span>)}
      </span>
    )
  }
  const editable = puede('ordenes.gestionar') && opciones.length > 0
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
      <Link2 className="h-3.5 w-3.5" />
      {editable ? (
        <select className="bg-transparent text-xs font-semibold outline-none" value={o.orden_relacionada_id ?? ''} onChange={e => cambiar(e.target.value)} aria-label="Relación con orden de aseguradora">
          <option value="">Particular sin relación con aseguradora</option>
          {opciones.map(x => <option key={x.id} value={x.id}>Particular de la orden de aseguradora {x.folio}</option>)}
        </select>
      ) : o.relacionada_folio
        ? <>Particular de la orden de aseguradora <Link className="underline" to={`/ordenes/${o.orden_relacionada_id}`}>{o.relacionada_folio}</Link></>
        : 'Particular sin relación con aseguradora'}
    </span>
  )
}
