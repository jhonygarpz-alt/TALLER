import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { errorTexto, fechaHora, money2, num } from '../../lib/format'
import { Card, Empty, ErrorMsg, Field } from '../../components/ui'
import Solicitudes from '../../components/Solicitudes'
import { Galeria } from '../../components/Fotos'
import type { TabProps } from './Expediente'

const DESTINOS: Record<string, string> = {
  pendiente: 'Pendiente de definir', devolucion: 'Devolución', resguardo: 'Resguardo en taller',
  entrega_propietario: 'Entrega al propietario', disposicion_autorizada: 'Disposición autorizada',
}
interface Pieza { id: number; pieza: string; destino: string; responsable: string | null; fecha: string; notas: string | null }
interface Pintura { cantidad_presupuestada: number; cantidad_real: number; costo_presupuestado: number; costo_real: number; diferencia: number; entregado_por: string | null }

export default function Materiales({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [pint, setPint] = useState<Pintura | null>(null)
  const [f, setF] = useState({ pieza: '', destino: 'resguardo', responsable: '', notas: '' })
  const [error, setError] = useState<string | null>(null)
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  const editarPiezas = puede('ordenes.gestionar') || puede('almacen.gestionar') || puede('actividades.asignar')

  const cargar = useCallback(async () => {
    const [p, v] = await Promise.all([
      supabase.from('piezas_retiradas').select('*').eq('orden_id', o.id).order('fecha'),
      supabase.from('v_pintura').select('*').eq('orden_id', o.id).maybeSingle(),
    ])
    setPiezas((p.data ?? []) as Pieza[]); setPint(v.data as Pintura | null)
  }, [o.id])
  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('piezas_retiradas').insert({ orden_id: o.id, ...f, responsable: f.responsable || null, notas: f.notas || null })
    if (error) return setError(errorTexto(error))
    setF({ pieza: '', destino: 'resguardo', responsable: '', notas: '' }); setError(null); cargar()
  }
  async function cambiarDestino(p: Pieza, destino: string) {
    const { error } = await supabase.from('piezas_retiradas').update({ destino }).eq('id', p.id)
    setError(error ? errorTexto(error) : null); cargar()
  }

  const desv = pint && pint.costo_presupuestado > 0 ? ((pint.costo_real - pint.costo_presupuestado) / pint.costo_presupuestado) * 100 : null
  return (
    <div className="space-y-5">
      <Card title="Solicitudes de material de esta orden">
        <Solicitudes ordenId={o.id} cerrada={o.etapa === 'cancelado'} onCambio={() => { cargar(); recargar() }} />
      </Card>

      <Card title="Control de pintura: presupuestado vs real">
        {!pint ? <Empty>Sin pintura presupuestada ni entregada</Empty> : (
          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Consumo presupuestado', num(pint.cantidad_presupuestada, 3)], ['Consumo real', num(pint.cantidad_real, 3)],
              ['Costo presupuestado', money2(pint.costo_presupuestado)], ['Costo real', money2(pint.costo_real)],
              ['Diferencia', <span className={pint.diferencia > 0 ? 'text-red-600' : 'text-green-700'}>{money2(pint.diferencia)}{desv !== null && ` (${desv > 0 ? '+' : ''}${desv.toFixed(1)}%)`}</span>],
              ['Entregó', pint.entregado_por ?? '—'],
            ].map(([k, v]) => <div key={k as string} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{k}</div><div className="font-bold">{v}</div></div>)}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">Presupuestado: partidas de concepto “Pintura” autorizadas (cantidad × costo estimado). Real: entregas de almacén de materiales tipo pintura. Las cantidades se suman en la unidad de cada material.</p>
      </Card>

      <Card title="Piezas retiradas">
        <ErrorMsg error={error} />
        {piezas.length === 0 ? <Empty>Sin piezas retiradas registradas</Empty> : (
          <div className="space-y-3">
            {piezas.map(p => (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b>{p.pieza}</b> <span className="text-xs text-slate-500">· {fechaHora(p.fecha)}{p.responsable && ` · Responsable: ${p.responsable}`}</span>{p.notas && <div className="text-sm text-slate-600">{p.notas}</div>}</div>
                  <select className="input w-auto" value={p.destino} disabled={!editarPiezas} onChange={e => cambiarDestino(p, e.target.value)}>
                    {Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="mt-2"><Galeria ordenId={o.id} categoria="pieza_retirada" refId={p.id} compacta /></div>
              </div>
            ))}
          </div>
        )}
        {!cerrada && editarPiezas && (
          <form onSubmit={agregar} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_12rem_1fr_auto]">
            <Field label="Pieza *"><input className="input" required value={f.pieza} onChange={e => setF({ ...f, pieza: e.target.value })} /></Field>
            <Field label="Destino"><select className="input" value={f.destino} onChange={e => setF({ ...f, destino: e.target.value })}>{Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Responsable"><input className="input" value={f.responsable} onChange={e => setF({ ...f, responsable: e.target.value })} /></Field>
            <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /> Registrar</button>
          </form>
        )}
      </Card>
    </div>
  )
}
