import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, FilePlus2, Plus, Send, Trash2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { AREAS, CONCEPTOS, ESTADO_PRESUPUESTO, errorTexto, fechaHora, money, money2, num } from '../../lib/format'
import { Badge, Card, Empty, ErrorMsg, Field, TableWrap } from '../../components/ui'
import type { TabProps } from './Expediente'

interface Partida { id: number; area: string; concepto: string; descripcion: string; cantidad: number; unidad: string; precio_unit: number; costo_unit: number }
interface Pres { id: number; numero: number; es_ampliacion: boolean; estado: string; autorizado_por: string | null; referencia_aut: string | null; fecha_autorizacion: string | null; notas: string | null; created_at: string; presupuesto_partidas: Partida[] }

const total = (p: Pres) => p.presupuesto_partidas.reduce((s, x) => s + x.cantidad * x.precio_unit, 0)

export default function Presupuesto({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [pres, setPres] = useState<Pres[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState({ area: 'hojalateria', concepto: 'mano_obra', descripcion: '', cantidad: '1', unidad: 'pza', precio_unit: '', costo_unit: '0' })
  const [aut, setAut] = useState({ por: '', ref: '' })
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('presupuestos').select('*, presupuesto_partidas(*)').eq('orden_id', o.id).order('numero')
    const list = (data ?? []) as Pres[]
    list.forEach(p => p.presupuesto_partidas.sort((a, b) => a.id - b.id))
    setPres(list)
    setSel(s => s ?? list[list.length - 1]?.id ?? null)
  }, [o.id])
  useEffect(() => { cargar() }, [cargar])

  const p = pres.find(x => x.id === sel)
  const hayBorrador = pres.some(x => x.estado === 'borrador' || x.estado === 'enviado')

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok?: () => void) {
    const { error } = await fn()
    if (error) { setError(errorTexto(error)); return }
    setError(null); ok?.(); await cargar(); recargar()
  }

  const nuevo = () => run(() => supabase.from('presupuestos').insert({ orden_id: o.id }).select('id').single().then(r => { if (r.data) setSel(r.data.id); return r }))
  const agregar = (e: FormEvent) => { e.preventDefault(); run(() => supabase.from('presupuesto_partidas').insert({ presupuesto_id: sel, ...f }), () => setF({ ...f, descripcion: '', cantidad: '1', precio_unit: '', costo_unit: '0' })) }
  const quitar = (id: number) => run(() => supabase.from('presupuesto_partidas').delete().eq('id', id))
  const enviar = () => confirm('¿Enviar presupuesto para autorización? Ya no podrá modificarse.') && run(() => supabase.rpc('presupuesto_enviar', { p_id: sel }))
  const resolver = (autorizar: boolean) => {
    if (!aut.por.trim()) return setError('Indica quién autoriza o rechaza (cliente / ajustador)')
    if (!confirm(autorizar ? '¿Registrar AUTORIZACIÓN del presupuesto?' : '¿Registrar RECHAZO del presupuesto?')) return
    run(() => supabase.rpc('presupuesto_resolver', { p_id: sel, p_autorizar: autorizar, p_autorizado_por: aut.por, p_referencia: aut.ref || null }), () => setAut({ por: '', ref: '' }))
  }
  const eliminar = () => confirm('¿Eliminar este borrador?') && run(() => supabase.from('presupuestos').delete().eq('id', sel!), () => setSel(null))

  const totalAut = pres.filter(x => x.estado === 'autorizado').reduce((s, x) => s + total(x), 0)
  const porArea = p ? Object.entries(p.presupuesto_partidas.reduce<Record<string, number>>((acc, x) => { acc[x.area] = (acc[x.area] ?? 0) + x.cantidad * x.precio_unit; return acc }, {})) : []

  return (
    <div className="space-y-5">
      <ErrorMsg error={error} />
      <div className="flex flex-wrap items-center gap-2">
        {pres.map(x => (
          <button key={x.id} onClick={() => setSel(x.id)}
            className={`rounded-xl border-2 px-4 py-2 text-left text-sm ${sel === x.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <div className="font-bold">{x.es_ampliacion ? 'Ampliación' : 'Presupuesto'} #{x.numero}</div>
            <div className="flex items-center gap-2"><Badge cls={ESTADO_PRESUPUESTO[x.estado].badge}>{ESTADO_PRESUPUESTO[x.estado].label}</Badge><span className="text-xs">{money(total(x))}</span></div>
          </button>
        ))}
        {!cerrada && !hayBorrador && puede('presupuestos.gestionar') && (
          <button className="btn btn-primary" onClick={nuevo}><FilePlus2 className="h-4 w-4" /> {pres.some(x => x.estado === 'autorizado') ? 'Nueva ampliación' : 'Nuevo presupuesto'}</button>
        )}
        <div className="ml-auto text-right text-sm"><div className="text-xs text-slate-500">Total autorizado (incl. ampliaciones)</div><div className="text-xl font-extrabold text-green-700">{money2(totalAut)}</div></div>
      </div>

      {!p ? <Card><Empty>No hay presupuestos. Crea el primero después del diagnóstico.</Empty></Card> : (
        <Card title={`${p.es_ampliacion ? 'Ampliación' : 'Presupuesto'} #${p.numero}`} action={<Badge cls={ESTADO_PRESUPUESTO[p.estado].badge}>{ESTADO_PRESUPUESTO[p.estado].label}</Badge>}>
          {p.presupuesto_partidas.length === 0 ? <Empty>Agrega las partidas del presupuesto</Empty> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th>Área</th><th>Concepto</th><th>Descripción</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Importe</th><th className="text-right">Costo est.</th><th></th></tr></thead>
                <tbody>{p.presupuesto_partidas.map(x => (
                  <tr key={x.id}>
                    <td>{AREAS[x.area]}</td><td>{CONCEPTOS[x.concepto]}</td><td>{x.descripcion}</td>
                    <td className="text-right">{num(x.cantidad, 3)} {x.unidad}</td><td className="text-right">{money2(x.precio_unit)}</td>
                    <td className="text-right font-semibold">{money2(x.cantidad * x.precio_unit)}</td>
                    <td className="text-right text-slate-500">{x.costo_unit > 0 ? money2(x.cantidad * x.costo_unit) : '—'}</td>
                    <td>{p.estado === 'borrador' && puede('presupuestos.gestionar') && <button className="text-red-500" onClick={() => quitar(x.id)}><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>))}
                </tbody>
                <tfoot><tr><td colSpan={5} className="text-right font-semibold">Total</td><td className="text-right text-lg font-extrabold">{money2(total(p))}</td><td colSpan={2} /></tr></tfoot>
              </table>
            </TableWrap>
          )}
          {porArea.length > 0 && <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">{porArea.map(([a, v]) => <span key={a}>{AREAS[a]}: <b>{money(v)}</b></span>)}</div>}

          {p.estado === 'borrador' && puede('presupuestos.gestionar') && (<>
            <form onSubmit={agregar} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4 lg:grid-cols-8">
              <Field label="Área"><select className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Concepto"><select className="input" value={f.concepto} onChange={e => setF({ ...f, concepto: e.target.value, unidad: e.target.value === 'pintura' ? 'lt' : f.unidad })}>{Object.entries(CONCEPTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Descripción *" className="sm:col-span-2"><input className="input" required value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
              <Field label="Cantidad"><input className="input" type="number" step="0.001" min="0.001" required value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} /></Field>
              <Field label="Unidad"><input className="input" value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} /></Field>
              <Field label="Precio unit. *"><input className="input" type="number" step="0.01" min="0" required value={f.precio_unit} onChange={e => setF({ ...f, precio_unit: e.target.value })} /></Field>
              <Field label="Costo est. unit." hint="Para comparar vs real"><input className="input" type="number" step="0.01" min="0" value={f.costo_unit} onChange={e => setF({ ...f, costo_unit: e.target.value })} /></Field>
              <div className="flex items-end lg:col-span-8"><button className="btn btn-secondary"><Plus className="h-4 w-4" /> Agregar partida</button></div>
            </form>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn btn-ghost text-red-600" onClick={eliminar}>Eliminar borrador</button>
              <button className="btn btn-primary" onClick={enviar} disabled={p.presupuesto_partidas.length === 0}><Send className="h-4 w-4" /> Enviar a autorización</button>
            </div>
          </>)}

          {p.estado === 'enviado' && puede('presupuestos.autorizar') && (
            <div className="mt-4 grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Field label="Autoriza / rechaza *"><input className="input" value={aut.por} onChange={e => setAut({ ...aut, por: e.target.value })} placeholder={o.tipo === 'aseguradora' ? 'Ajustador / valuador de la aseguradora' : 'Nombre del cliente'} /></Field>
              <Field label="Referencia / folio de autorización"><input className="input" value={aut.ref} onChange={e => setAut({ ...aut, ref: e.target.value })} /></Field>
              <button className="btn btn-success self-end" onClick={() => resolver(true)}><CheckCircle2 className="h-4 w-4" /> Autorizar</button>
              <button className="btn btn-danger self-end" onClick={() => resolver(false)}><XCircle className="h-4 w-4" /> Rechazar</button>
            </div>
          )}
          {(p.estado === 'autorizado' || p.estado === 'rechazado') && (
            <p className="mt-3 text-sm text-slate-600">{p.estado === 'autorizado' ? 'Autorizado' : 'Rechazado'} por <b>{p.autorizado_por}</b> {p.referencia_aut && `· Ref. ${p.referencia_aut}`} · {fechaHora(p.fecha_autorizacion)}. Un presupuesto resuelto no se modifica: los cambios se registran como ampliación.</p>
          )}
        </Card>
      )}
    </div>
  )
}
