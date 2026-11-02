import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { AREAS, errorTexto } from '../../lib/format'
import { Badge, Card, Empty, ErrorMsg, Field } from '../../components/ui'
import { Galeria } from '../../components/Fotos'
import type { TabProps } from './Expediente'

interface Dano { id: number; area: string; pieza: string; descripcion: string | null }

export default function Diagnostico({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [danos, setDanos] = useState<Dano[]>([])
  const [f, setF] = useState({ area: 'hojalateria', pieza: '', descripcion: '' })
  const [error, setError] = useState<string | null>(null)
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  const editar = !cerrada && (puede('presupuestos.gestionar') || puede('ordenes.gestionar'))

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('danos').select('*').eq('orden_id', o.id).order('id')
    setDanos((data ?? []) as Dano[])
  }, [o.id])
  useEffect(() => { cargar() }, [cargar])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('danos').insert({ orden_id: o.id, ...f, descripcion: f.descripcion || null })
    if (error) return setError(errorTexto(error))
    setF({ ...f, pieza: '', descripcion: '' }); setError(null); cargar(); recargar()
  }
  async function borrar(id: number) {
    if (!confirm('¿Eliminar este daño? Sus fotografías se conservan en el expediente.')) return
    const { error } = await supabase.from('danos').delete().eq('id', id)
    if (error) setError(errorTexto(error)); else cargar()
  }

  return (
    <div className="space-y-5">
      <Card title="Daños identificados">
        <ErrorMsg error={error} />
        {danos.length === 0 ? <Empty>Sin daños registrados</Empty> : (
          <div className="space-y-3">
            {danos.map(d => (
              <div key={d.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2"><Badge cls="bg-slate-100 text-slate-700">{AREAS[d.area]}</Badge><span className="font-semibold">{d.pieza}</span></div>
                    {d.descripcion && <p className="mt-1 text-sm text-slate-600">{d.descripcion}</p>}
                  </div>
                  {editar && <button className="btn btn-ghost btn-sm text-red-600" onClick={() => borrar(d.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <div className="mt-3"><Galeria ordenId={o.id} categoria="dano" refId={d.id} puedeSubir={!cerrada} compacta /></div>
              </div>
            ))}
          </div>
        )}
        {editar && (
          <form onSubmit={agregar} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[10rem_1fr_1.5fr_auto]">
            <Field label="Área"><select className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Pieza *"><input className="input" required value={f.pieza} onChange={e => setF({ ...f, pieza: e.target.value })} placeholder="Ej. Puerta delantera izq." /></Field>
            <Field label="Descripción"><input className="input" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder="Ej. Abolladura media, rayón profundo" /></Field>
            <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /> Agregar</button>
          </form>
        )}
      </Card>
      <Card title="Fotografías generales de diagnóstico">
        <Galeria ordenId={o.id} categoria="diagnostico" puedeSubir={!cerrada} />
      </Card>
    </div>
  )
}
