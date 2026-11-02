import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { revertir } from '../../lib/revertir'
import { useAuth } from '../../lib/auth'
import { ESTADO_DESTAJO, errorTexto, fecha, hoyISO, money2, pct } from '../../lib/format'
import type { Rentabilidad } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, SinPermiso, TableWrap } from '../../components/ui'
import type { TabProps } from './Expediente'

interface Destajo { id: number; importe: number; estado: string; tipo: string; referencia_pago: string | null; tecnicos?: { nombre: string }; actividades?: { actividad: string; pieza: string | null } }
interface Costo { id: number; tipo: string; concepto: string; proveedor: string | null; monto: number; fecha: string }
interface Factura { id: number; folio: string; fecha: string; receptor: string; monto: number; cancelada: boolean }
interface Cobro { id: number; fecha: string; monto: number; metodo: string; referencia: string | null; factura_id: number | null }

const TIPOS_COSTO: Record<string, string> = { mano_obra_adicional: 'Mano de obra adicional', servicio_externo: 'Servicio externo', otro: 'Otro gasto directo' }

export function DesgloseRentabilidad({ r }: { r: Rentabilidad }) {
  const margen = r.ingreso_reconocido ? (r.utilidad_bruta / r.ingreso_reconocido) * 100 : NaN
  const fila = (k: string, v: number, cls = '') => <div className={`flex justify-between py-1 ${cls}`}><span>{k}</span><span>{money2(v)}</span></div>
  return (
    <div className="grid gap-5 text-sm md:grid-cols-2">
      <div>
        <div className="mb-1 text-xs font-bold text-slate-500 uppercase">Ingresos</div>
        {fila('Importe autorizado', r.autorizado)}
        {fila('Trabajos adicionales autorizados', r.adicional)}
        {fila('Ingreso reconocido', r.ingreso_reconocido, 'border-t font-bold')}
        {fila('Importe facturado', r.facturado, 'text-slate-500')}
        {fila('Importe cobrado', r.cobrado, 'text-slate-500')}
        {fila('Pendiente de cobro', r.por_cobrar, r.por_cobrar > 0 ? 'font-semibold text-red-600' : 'text-slate-500')}
      </div>
      <div>
        <div className="mb-1 text-xs font-bold text-slate-500 uppercase">Costos directos</div>
        {fila('Pintura', r.costo_pintura)}{fila('Materiales', r.costo_materiales)}{fila('Refacciones', r.costo_refacciones)}
        {fila('Destajos', r.costo_destajos)}{fila('Mano de obra adicional', r.costo_mano_obra_adicional)}
        {fila('Servicios externos', r.costo_servicios_externos)}{fila('Otros gastos directos', r.costo_otros)}
        {fila('Total costos directos', r.costos_directos, 'border-t font-bold')}
      </div>
      <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
        <div className="flex flex-wrap justify-between gap-4">
          <div><div className="text-xs text-slate-500">Utilidad bruta (ingreso reconocido − costos directos)</div><div className={`text-2xl font-extrabold ${r.utilidad_bruta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money2(r.utilidad_bruta)} <span className="text-sm">({pct(margen)})</span></div></div>
          <div><div className="text-xs text-slate-500">Gastos indirectos asignados ({r.indirectos_pct}% del ingreso)</div><div className="text-lg font-bold">{money2(r.indirectos_asignados)}</div></div>
          <div><div className="text-xs text-slate-500">Utilidad estimada después de indirectos</div><div className={`text-2xl font-extrabold ${r.utilidad_estimada >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money2(r.utilidad_estimada)}</div></div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">El % de indirectos es un criterio configurable (Configuración → Parámetros). Los costos se cargan automáticamente desde entregas de almacén, compras directas, destajos validados y costos registrados aquí.</p>
      </div>
    </div>
  )
}

export default function Costos({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const [r, setR] = useState<Rentabilidad | null>(null)
  const [destajos, setDestajos] = useState<Destajo[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fc, setFc] = useState({ tipo: 'servicio_externo', concepto: '', proveedor: '', monto: '', fecha: hoyISO() })
  const [ff, setFf] = useState({ folio: '', receptor: o.tipo === 'aseguradora' ? 'aseguradora' : 'cliente', monto: '', fecha: hoyISO() })
  const [fp, setFp] = useState({ monto: '', metodo: 'transferencia', referencia: '', factura_id: '', fecha: hoyISO() })
  const verFin = puede('finanzas.ver'), gestFin = puede('finanzas.gestionar')

  const cargar = useCallback(async () => {
    const qs = await Promise.all([
      supabase.from('v_rentabilidad').select('*').eq('orden_id', o.id).maybeSingle(),
      supabase.from('destajos').select('*, tecnicos(nombre), actividades(actividad,pieza)').eq('orden_id', o.id).order('id'),
      supabase.from('orden_costos').select('*').eq('orden_id', o.id).order('fecha'),
      supabase.from('facturas').select('*').eq('orden_id', o.id).order('fecha'),
      supabase.from('cobros').select('*').eq('orden_id', o.id).order('fecha'),
    ])
    setR(qs[0].data as Rentabilidad); setDestajos((qs[1].data ?? []) as Destajo[]); setCostos((qs[2].data ?? []) as Costo[])
    setFacturas((qs[3].data ?? []) as Factura[]); setCobros((qs[4].data ?? []) as Cobro[])
  }, [o.id])
  useEffect(() => { cargar() }, [cargar])

  async function ins(tabla: string, datos: Record<string, unknown>, reset: () => void) {
    const { error } = await supabase.from(tabla).insert({ orden_id: o.id, ...datos })
    if (error) return setError(errorTexto(error))
    setError(null); reset(); cargar(); recargar()
  }
  async function borrar(tabla: 'orden_costos' | 'cobros', id: number, desc: string) {
    if (!confirm(`¿Eliminar ${desc}? Quedará registrado en auditoría.`)) return
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    setError(error ? errorTexto(error) : null); cargar(); recargar()
  }
  async function cancelarFactura(fa: Factura) {
    if (!confirm(`¿Marcar la factura ${fa.folio} como cancelada? Quedará registrada en auditoría.`)) return
    const { error } = await supabase.from('facturas').update({ cancelada: true }).eq('id', fa.id)
    setError(error ? errorTexto(error) : null); cargar()
  }

  if (!verFin && !puede('destajos.ver')) return <SinPermiso que="los costos de la orden" />
  return (
    <div className="space-y-5">
      <ErrorMsg error={error} />
      {verFin && r && <Card title="Rentabilidad de la orden"><DesgloseRentabilidad r={r} /></Card>}

      {puede('destajos.ver') && (
        <Card title={`Destajos (${o.tipo === 'aseguradora' ? 'aseguradora' : 'particular'})`}>
          {destajos.length === 0 ? <Empty>Sin destajos generados. Se generan al validar trabajos con tarifa.</Empty> : (
            <TableWrap><table className="tbl">
              <thead><tr><th>Técnico</th><th>Actividad</th><th>Estado</th><th>Referencia de pago</th><th className="text-right">Importe</th></tr></thead>
              <tbody>{destajos.map(d => (
                <tr key={d.id}><td>{d.tecnicos?.nombre}</td><td>{d.actividades?.actividad} {d.actividades?.pieza && <span className="text-slate-500">· {d.actividades.pieza}</span>}</td>
                  <td><Badge cls={ESTADO_DESTAJO[d.estado].badge}>{ESTADO_DESTAJO[d.estado].label}</Badge></td><td>{d.referencia_pago ?? '—'}</td><td className="text-right font-semibold">{money2(d.importe)}
                  {d.estado !== 'cancelado' && puede('excepciones.autorizar') && <button className="ml-2 text-xs font-normal text-red-600 hover:underline" onClick={async () => {
                    const x = await revertir('destajo_cancelar', { p_id: d.id }, `¿Cancelar el destajo de ${d.tecnicos?.nombre} por ${money2(d.importe)}${d.estado === 'pagado' ? ' (YA PAGADO)' : ''}?`)
                    if (x !== undefined) { setError(x); cargar(); recargar() }
                  }}>Cancelar</button>}</td></tr>))}
              </tbody>
            </table></TableWrap>
          )}
        </Card>
      )}

      {verFin && (<>
        <Card title="Otros costos directos (mano de obra adicional, servicios externos, otros)">
          {costos.length === 0 ? <Empty>Sin costos adicionales</Empty> : (
            <TableWrap><table className="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Proveedor</th><th className="text-right">Monto</th></tr></thead>
              <tbody>{costos.map(c => <tr key={c.id}><td>{fecha(c.fecha)}</td><td>{TIPOS_COSTO[c.tipo]}</td><td>{c.concepto}</td><td>{c.proveedor ?? '—'}</td><td className="text-right">{money2(c.monto)}{gestFin && <button className="ml-2 text-xs text-red-600 hover:underline" onClick={() => borrar('orden_costos', c.id, `${c.concepto} por ${money2(c.monto)}`)}>Eliminar</button>}</td></tr>)}</tbody>
            </table></TableWrap>
          )}
          {gestFin && o.etapa !== 'cancelado' && (
            <form className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[11rem_1fr_1fr_8rem_9rem_auto]" onSubmit={e => { e.preventDefault(); ins('orden_costos', { ...fc, proveedor: fc.proveedor || null }, () => setFc({ ...fc, concepto: '', proveedor: '', monto: '' })) }}>
              <Field label="Tipo"><select className="input" value={fc.tipo} onChange={e => setFc({ ...fc, tipo: e.target.value })}>{Object.entries(TIPOS_COSTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Concepto *"><input className="input" required value={fc.concepto} onChange={e => setFc({ ...fc, concepto: e.target.value })} /></Field>
              <Field label="Proveedor"><input className="input" value={fc.proveedor} onChange={e => setFc({ ...fc, proveedor: e.target.value })} /></Field>
              <Field label="Monto *"><input className="input" type="number" step="0.01" min="0.01" required value={fc.monto} onChange={e => setFc({ ...fc, monto: e.target.value })} /></Field>
              <Field label="Fecha"><input className="input" type="date" value={fc.fecha} onChange={e => setFc({ ...fc, fecha: e.target.value })} /></Field>
              <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /></button>
            </form>
          )}
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Facturas">
            {facturas.length === 0 ? <Empty>Sin facturas</Empty> : (
              <ul className="divide-y text-sm">{facturas.map(fa => (
                <li key={fa.id} className={`flex items-center justify-between gap-2 py-2 ${fa.cancelada ? 'text-slate-400 line-through' : ''}`}>
                  <span><b>{fa.folio}</b> · {fecha(fa.fecha)} · {fa.receptor === 'aseguradora' ? 'Aseguradora' : 'Cliente'}</span>
                  <span className="flex items-center gap-2">{money2(fa.monto)}{gestFin && !fa.cancelada && <button className="text-xs text-red-600 no-underline" onClick={() => cancelarFactura(fa)}>Cancelar</button>}</span>
                </li>))}
              </ul>
            )}
            {gestFin && o.etapa !== 'cancelado' && (
              <form className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3" onSubmit={e => { e.preventDefault(); ins('facturas', ff, () => setFf({ ...ff, folio: '', monto: '' })) }}>
                <Field label="Folio *"><input className="input" required value={ff.folio} onChange={e => setFf({ ...ff, folio: e.target.value })} /></Field>
                <Field label="Receptor"><select className="input" value={ff.receptor} onChange={e => setFf({ ...ff, receptor: e.target.value })}><option value="aseguradora">Aseguradora</option><option value="cliente">Cliente</option></select></Field>
                <Field label="Monto *"><input className="input" type="number" step="0.01" min="0.01" required value={ff.monto} onChange={e => setFf({ ...ff, monto: e.target.value })} /></Field>
                <Field label="Fecha"><input className="input" type="date" value={ff.fecha} onChange={e => setFf({ ...ff, fecha: e.target.value })} /></Field>
                <button className="btn btn-primary col-span-2">Registrar factura</button>
              </form>
            )}
          </Card>
          <Card title="Cobros">
            {cobros.length === 0 ? <Empty>Sin cobros registrados</Empty> : (
              <ul className="divide-y text-sm">{cobros.map(c => (
                <li key={c.id} className="flex justify-between py-2"><span>{fecha(c.fecha)} · <span className="capitalize">{c.metodo}</span>{c.referencia && ` · ${c.referencia}`}</span><span className="flex items-center gap-2"><b>{money2(c.monto)}</b>{gestFin && <button className="text-xs text-red-600 hover:underline" onClick={() => borrar('cobros', c.id, `el cobro de ${money2(c.monto)}`)}>Eliminar</button>}</span></li>))}
              </ul>
            )}
            {gestFin && o.etapa !== 'cancelado' && (
              <form className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3" onSubmit={e => { e.preventDefault(); ins('cobros', { ...fp, factura_id: fp.factura_id ? Number(fp.factura_id) : null, referencia: fp.referencia || null }, () => setFp({ ...fp, monto: '', referencia: '' })) }}>
                <Field label="Monto *"><input className="input" type="number" step="0.01" min="0.01" required value={fp.monto} onChange={e => setFp({ ...fp, monto: e.target.value })} /></Field>
                <Field label="Método"><select className="input" value={fp.metodo} onChange={e => setFp({ ...fp, metodo: e.target.value })}>{['transferencia', 'efectivo', 'tarjeta', 'cheque', 'deducible'].map(m => <option key={m} value={m} className="capitalize">{m}</option>)}</select></Field>
                <Field label="Factura"><select className="input" value={fp.factura_id} onChange={e => setFp({ ...fp, factura_id: e.target.value })}><option value="">—</option>{facturas.filter(x => !x.cancelada).map(x => <option key={x.id} value={x.id}>{x.folio}</option>)}</select></Field>
                <Field label="Fecha"><input className="input" type="date" value={fp.fecha} onChange={e => setFp({ ...fp, fecha: e.target.value })} /></Field>
                <Field label="Referencia" className="col-span-2"><input className="input" value={fp.referencia} onChange={e => setFp({ ...fp, referencia: e.target.value })} /></Field>
                <button className="btn btn-primary col-span-2">Registrar cobro</button>
              </form>
            )}
          </Card>
        </div>
      </>)}
    </div>
  )
}
