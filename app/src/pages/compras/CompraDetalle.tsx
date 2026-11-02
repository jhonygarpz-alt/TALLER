import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, PackageCheck, Plus, Send, Trash2, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { ESTADO_COMPRA, errorTexto, fecha, fechaHora, money2, num } from '../../lib/format'
import type { Material, Proveedor } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, PageHeader } from '../../components/ui'

interface Compra { id: number; proveedor_id: number | null; estado: string; fecha: string; factura: string | null; notas: string | null; autorizado_at: string | null; recibido_at: string | null; created_at: string }
interface Partida { id: number; material_id: number; orden_id: number | null; cantidad: number; costo_unit: number; materiales?: { descripcion: string; unidad: string; costo_promedio: number }; ordenes?: { folio: string } | null }
interface Cotizacion { id: number; proveedor_id: number; importe: number; dias_entrega: number | null; notas: string | null; elegida: boolean; proveedores?: { nombre: string } }
interface Precio { material_id: number; fecha: string; costo_unit: number; proveedores?: { nombre: string } | null }

export default function CompraDetalle() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  const { puede } = useAuth()
  const al = useAlertas()
  const [c, setC] = useState<Compra | null>(null)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [cots, setCots] = useState<Cotizacion[]>([])
  const [precios, setPrecios] = useState<Precio[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ordenes, setOrdenes] = useState<{ id: number; folio: string; marca: string; modelo: string }[]>([])
  const [fp, setFp] = useState({ material_id: '', orden_id: '', cantidad: '', costo_unit: '' })
  const [fc, setFc] = useState({ proveedor_id: '', importe: '', dias_entrega: '', notas: '' })
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [a, b, d] = await Promise.all([
      supabase.from('compras').select('*').eq('id', id).single(),
      supabase.from('compra_partidas').select('*, materiales(descripcion,unidad,costo_promedio), ordenes(folio)').eq('compra_id', id).order('id'),
      supabase.from('cotizaciones').select('*, proveedores(nombre)').eq('compra_id', id).order('importe'),
    ])
    setC(a.data as Compra); const ps = (b.data ?? []) as Partida[]; setPartidas(ps); setCots((d.data ?? []) as Cotizacion[])
    if (ps.length) {
      const { data } = await supabase.from('precios_historial').select('material_id, fecha, costo_unit, proveedores(nombre)').in('material_id', ps.map(p => p.material_id)).order('fecha', { ascending: false }).limit(60)
      setPrecios((data ?? []) as unknown as Precio[])
    }
  }, [id])
  useEffect(() => {
    cargar()
    supabase.from('materiales').select('*').eq('activo', true).order('descripcion').then(({ data }) => setMateriales((data ?? []) as Material[]))
    supabase.from('proveedores').select('*').order('nombre').then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
    supabase.from('v_ordenes').select('id,folio,marca,modelo').not('etapa', 'in', '(entregado,cancelado)').order('folio').then(({ data }) => setOrdenes(data ?? []))
  }, [cargar])

  async function run(p: PromiseLike<{ error: unknown }>, ok?: () => void) {
    const { error } = await p
    setError(error ? errorTexto(error) : null)
    if (!error) { ok?.(); cargar(); al.recargar() }
  }
  const accion = (acc: string, msg: string, factura?: string) => confirm(msg) && run(supabase.rpc('compra_accion', { p_id: id, p_accion: acc, p_factura: factura ?? null }))

  if (!c) return <div className="text-slate-400">Cargando…</div>
  const editable = ['requisicion', 'por_autorizar'].includes(c.estado) && puede('compras.gestionar')
  const total = partidas.reduce((s, p) => s + p.cantidad * p.costo_unit, 0)

  function recibir() {
    const f = prompt('Número de factura o nota del proveedor:', c?.factura ?? '')
    if (!f) return
    accion('recibir', `¿Registrar la recepción? Se ingresarán ${partidas.length} partida(s) al inventario y se actualizará el costo promedio. Las partidas ligadas a una orden se cargarán directo a esa orden.`, f)
  }

  return (
    <div className="space-y-5">
      <Link to="/compras?tab=compras" className="text-sm font-medium text-blue-600 hover:underline">← Compras</Link>
      <PageHeader title={`Requisición REQ-${String(c.id).padStart(4, '0')}`} subtitle={<>Creada {fechaHora(c.created_at)} · <Badge cls={ESTADO_COMPRA[c.estado].badge}>{ESTADO_COMPRA[c.estado].label}</Badge></>}>
        {c.estado === 'requisicion' && puede('compras.gestionar') && <>
          <button className="btn btn-ghost text-red-600" onClick={() => confirm('¿Eliminar requisición?') && run(supabase.from('compras').delete().eq('id', id), () => nav('/compras?tab=compras'))}><Trash2 className="h-4 w-4" /></button>
          <button className="btn btn-primary" disabled={!partidas.length} onClick={() => accion('enviar', '¿Enviar a autorización? Las partidas ya no se podrán modificar después de autorizada.')}><Send className="h-4 w-4" /> Solicitar autorización</button>
        </>}
        {c.estado === 'por_autorizar' && puede('compras.autorizar') && <button className="btn btn-success" onClick={() => accion('autorizar', `¿Autorizar compra por ${money2(total)}?`)}><CheckCircle2 className="h-4 w-4" /> Autorizar compra</button>}
        {c.estado === 'autorizada' && puede('compras.gestionar') && <button className="btn btn-success" onClick={recibir}><PackageCheck className="h-4 w-4" /> Registrar recepción y factura</button>}
        {!['recibida', 'cancelada'].includes(c.estado) && (puede('compras.gestionar') || puede('compras.autorizar')) && c.estado !== 'requisicion' &&
          <button className="btn btn-secondary" onClick={() => accion('cancelar', '¿Cancelar esta compra?')}><XCircle className="h-4 w-4" /> Cancelar</button>}
      </PageHeader>
      <ErrorMsg error={error} />

      <Card title="Datos de la compra">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Proveedor">
            <select className="input" value={c.proveedor_id ?? ''} disabled={!editable} onChange={e => run(supabase.from('compras').update({ proveedor_id: e.target.value || null }).eq('id', id))}>
              <option value="">—</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input className="input" disabled value={fecha(c.fecha)} /></Field>
          <Field label="Factura"><input className="input" disabled value={c.factura ?? 'Se registra al recibir'} /></Field>
        </div>
        {c.notas && <p className="mt-3 text-sm text-slate-600">{c.notas}</p>}
        {c.autorizado_at && <p className="mt-2 text-xs text-slate-500">Autorizada {fechaHora(c.autorizado_at)}{c.recibido_at && ` · Recibida ${fechaHora(c.recibido_at)}`}</p>}
      </Card>

      <Card title="Partidas">
        {partidas.length === 0 ? <Empty>Agrega los materiales a comprar</Empty> : (
          <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
            <thead><tr><th>Material</th><th>Cargo directo a orden</th><th className="text-right">Cantidad</th><th className="text-right">Costo unit.</th><th className="text-right">Último / promedio</th><th className="text-right">Importe</th><th></th></tr></thead>
            <tbody>{partidas.map(p => {
              const ult = precios.find(x => x.material_id === p.material_id)
              const ref = ult?.costo_unit ?? p.materiales?.costo_promedio ?? 0
              const sube = ref > 0 && p.costo_unit > ref * 1.1
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.materiales?.descripcion}</td><td>{p.ordenes?.folio ?? <span className="text-xs text-slate-400">Inventario</span>}</td>
                  <td className="text-right">{num(p.cantidad, 3)} {p.materiales?.unidad}</td>
                  <td className={`text-right ${sube ? 'font-semibold text-red-600' : ''}`}>{money2(p.costo_unit)}</td>
                  <td className="text-right text-xs text-slate-500">{ref ? money2(ref) : '—'}{sube && <div className="text-red-600">+{(((p.costo_unit / ref) - 1) * 100).toFixed(0)}%</div>}</td>
                  <td className="text-right font-semibold">{money2(p.cantidad * p.costo_unit)}</td>
                  <td>{editable && c.estado === 'requisicion' && <button className="text-red-500" onClick={() => run(supabase.from('compra_partidas').delete().eq('id', p.id))}><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>)
            })}</tbody>
            <tfoot><tr><td colSpan={5} className="text-right font-semibold">Total</td><td className="text-right text-lg font-extrabold">{money2(total)}</td><td /></tr></tfoot>
          </table></div>
        )}
        {c.estado === 'requisicion' && puede('compras.gestionar') && (
          <form className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.5fr_1fr_7rem_8rem_auto]" onSubmit={(e: FormEvent) => { e.preventDefault(); run(supabase.from('compra_partidas').insert({ compra_id: id, material_id: Number(fp.material_id), orden_id: fp.orden_id ? Number(fp.orden_id) : null, cantidad: Number(fp.cantidad), costo_unit: Number(fp.costo_unit) }), () => setFp({ material_id: '', orden_id: '', cantidad: '', costo_unit: '' })) }}>
            <Field label="Material *"><select className="input" required value={fp.material_id} onChange={e => { const m = materiales.find(x => String(x.id) === e.target.value); setFp({ ...fp, material_id: e.target.value, costo_unit: m?.costo_promedio ? String(m.costo_promedio) : fp.costo_unit }) }}>
              <option value="">Selecciona…</option>{materiales.map(m => <option key={m.id} value={m.id}>{m.descripcion} ({m.unidad})</option>)}</select></Field>
            <Field label="Orden (opcional)"><select className="input" value={fp.orden_id} onChange={e => setFp({ ...fp, orden_id: e.target.value })}><option value="">Para inventario</option>{ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.marca} {o.modelo}</option>)}</select></Field>
            <Field label="Cantidad *"><input className="input" type="number" step="0.001" min="0.001" required value={fp.cantidad} onChange={e => setFp({ ...fp, cantidad: e.target.value })} /></Field>
            <Field label="Costo unit. *"><input className="input" type="number" step="0.0001" min="0" required value={fp.costo_unit} onChange={e => setFp({ ...fp, costo_unit: e.target.value })} /></Field>
            <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /></button>
          </form>
        )}
      </Card>

      <Card title="Cotizaciones comparativas">
        {cots.length === 0 ? <Empty>Sin cotizaciones registradas</Empty> : (
          <ul className="divide-y text-sm">{cots.map((x, i) => (
            <li key={x.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${x.elegida ? 'font-semibold' : ''}`}>
              <span>{i === 0 && <Badge cls="bg-green-100 text-green-700">Menor precio</Badge>} {x.proveedores?.nombre} {x.dias_entrega != null && <span className="text-slate-500">· {x.dias_entrega} días</span>} {x.notas && <span className="text-slate-500">· {x.notas}</span>}</span>
              <span className="flex items-center gap-2">{money2(x.importe)}
                {x.elegida ? <Badge cls="bg-blue-600 text-white">Elegida</Badge> : editable && <button className="btn btn-secondary btn-sm" onClick={() => run(Promise.all([
                  supabase.from('cotizaciones').update({ elegida: false }).eq('compra_id', id),
                ]).then(() => supabase.from('cotizaciones').update({ elegida: true }).eq('id', x.id)).then(() => supabase.from('compras').update({ proveedor_id: x.proveedor_id }).eq('id', id)))}>Elegir</button>}
              </span>
            </li>))}
          </ul>
        )}
        {editable && (
          <form className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.5fr_8rem_6rem_1fr_auto]" onSubmit={(e: FormEvent) => { e.preventDefault(); run(supabase.from('cotizaciones').insert({ compra_id: id, proveedor_id: Number(fc.proveedor_id), importe: Number(fc.importe), dias_entrega: fc.dias_entrega ? Number(fc.dias_entrega) : null, notas: fc.notas || null }), () => setFc({ proveedor_id: '', importe: '', dias_entrega: '', notas: '' })) }}>
            <Field label="Proveedor *"><select className="input" required value={fc.proveedor_id} onChange={e => setFc({ ...fc, proveedor_id: e.target.value })}><option value="">—</option>{proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
            <Field label="Importe *"><input className="input" type="number" step="0.01" min="0" required value={fc.importe} onChange={e => setFc({ ...fc, importe: e.target.value })} /></Field>
            <Field label="Días"><input className="input" type="number" min="0" value={fc.dias_entrega} onChange={e => setFc({ ...fc, dias_entrega: e.target.value })} /></Field>
            <Field label="Notas"><input className="input" value={fc.notas} onChange={e => setFc({ ...fc, notas: e.target.value })} /></Field>
            <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /></button>
          </form>
        )}
      </Card>

      {precios.length > 0 && (
        <Card title="Historial de precios de estos materiales">
          <ul className="divide-y text-sm">{precios.slice(0, 20).map((p, i) => (
            <li key={i} className="flex justify-between py-1.5"><span>{materiales.find(m => m.id === p.material_id)?.descripcion} · {p.proveedores?.nombre ?? '—'} · {fecha(p.fecha)}</span><b>{money2(p.costo_unit)}</b></li>))}
          </ul>
        </Card>
      )}
    </div>
  )
}
