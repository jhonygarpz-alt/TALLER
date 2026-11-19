import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePeriodo } from '../../lib/periodo'
import { ETAPAS, money2, pct, type Etapa } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Rentabilidad } from '../../lib/tipos'
import { Badge, Card, Empty } from '../../components/ui'
import PeriodoSelect from '../../components/PeriodoSelect'

interface Fila {
  orden_id: number; folio: string; tipo: string; etapa: Etapa; fecha: string
  presupuesto: number; ampliacion: number; particular: number; autorizado: number
  gastos_adicionales: number; materiales_pulido: number; mo_hojalatero: number; mo_pintor: number; materiales: number; refacciones: number
  porEntregar: number; suma: number; iva: number; total: number; ganancia: number; margen: number
}

const CLAVES = ['presupuesto', 'ampliacion', 'particular', 'autorizado', 'gastos_adicionales', 'materiales_pulido', 'mo_hojalatero', 'mo_pintor', 'materiales', 'refacciones', 'porEntregar', 'suma', 'iva', 'total', 'ganancia'] as const
const GASTOS: [typeof CLAVES[number], string][] = [['gastos_adicionales', 'Gastos adicionales'], ['materiales_pulido', 'Materiales pulido'], ['mo_hojalatero', 'M.O. Hojalatero'], ['mo_pintor', 'M.O. Pintor'], ['materiales', 'Materiales'], ['refacciones', 'Refacciones']]

/**
 * Acumulado de gastos económicos y autorizaciones por orden: lo autorizado (presupuesto, ampliaciones y particular),
 * los gastos desglosados (materiales y pintura, refacciones, mano de obra, servicios externos, pequeño material y otros,
 * material solicitado aún por entregar a costo estimado) y la ganancia resultante. Totales del periodo arriba.
 */
export default function GastosAcumulados() {
  const per = usePeriodo('mes')
  const [base, setBase] = useState<'ingreso' | 'entrega'>('ingreso')
  const [rows, setRows] = useState<Fila[] | null>(null)

  useEffect(() => {
    setRows(null)
    ;(async () => {
      const campo = base === 'ingreso' ? 'fecha_ingreso' : 'fecha_entrega'
      const { data: r } = await supabase.from('v_rentabilidad').select('*').neq('etapa', 'cancelado').gte(campo, per.desde).lt(campo, per.hasta).order(campo).limit(2000)
      const rent = (r ?? []) as Rentabilidad[]
      const ids = rent.map(x => x.orden_id)
      const [pres, des] = ids.length ? await Promise.all([
        supabase.from('presupuestos').select('orden_id,particular,es_ampliacion,presupuesto_partidas(cantidad,precio_unit)').in('orden_id', ids).eq('estado', 'autorizado'),
        supabase.rpc('gastos_desglose', { p_ids: ids }),
      ]) : [{ data: [] }, { data: [] }]
      type P = { orden_id: number; particular: boolean; es_ampliacion: boolean; presupuesto_partidas: { cantidad: number; precio_unit: number }[] }
      const aut: Record<number, { presupuesto: number; ampliacion: number; particular: number }> = {}
      for (const p of (pres.data ?? []) as P[]) {
        const t = p.presupuesto_partidas.reduce((s, x) => s + Number(x.cantidad) * Number(x.precio_unit), 0)
        const a = (aut[p.orden_id] ??= { presupuesto: 0, ampliacion: 0, particular: 0 })
        if (p.particular) a.particular += t; else if (p.es_ampliacion) a.ampliacion += t; else a.presupuesto += t
      }
      const gd: Record<number, Record<string, number>> = {}
      for (const g of (des.data ?? []) as Record<string, unknown>[]) gd[Number(g.orden_id)] = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Number(v)]))
      setRows(rent.map(x => {
        const a = aut[x.orden_id] ?? { presupuesto: 0, ampliacion: 0, particular: 0 }
        // En órdenes particulares el presupuesto completo lo paga el cliente
        const autorizado = a.presupuesto + a.ampliacion + a.particular
        const g = gd[x.orden_id] ?? {}
        const n = (k: string) => g[k] ?? 0
        const ganancia = autorizado - n('suma')
        return {
          orden_id: x.orden_id, folio: x.folio, tipo: x.tipo, etapa: x.etapa, fecha: (base === 'ingreso' ? x.fecha_ingreso : x.fecha_entrega ?? '').slice(0, 10),
          ...a, autorizado,
          gastos_adicionales: n('gastos_adicionales'), materiales_pulido: n('materiales_pulido'), mo_hojalatero: n('mo_hojalatero'), mo_pintor: n('mo_pintor'),
          materiales: n('materiales'), refacciones: n('refacciones'), porEntregar: n('por_entregar'), suma: n('suma'), iva: n('iva'), total: n('total'),
          ganancia, margen: autorizado ? (ganancia / autorizado) * 100 : NaN,
        }
      }))
    })()
  }, [per.desde, per.hasta, base])

  const tot = useMemo(() => (rows ?? []).reduce((t, r) => {
    for (const k of CLAVES) t[k] += r[k]
    return t
  }, Object.fromEntries(CLAVES.map(k => [k, 0])) as Record<typeof CLAVES[number], number>), [rows])
  const margen = tot.autorizado ? (tot.ganancia / tot.autorizado) * 100 : NaN

  const exportar = () => descargarCSV(`gastos_y_ganancias_${per.desde}`, (rows ?? []).map(r => ({ ...r, tipo: r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular', etapa: ETAPAS[r.etapa]?.label, margen: isNaN(r.margen) ? '' : r.margen.toFixed(1) })), [
    { key: 'folio', label: 'Orden' }, { key: 'fecha', label: base === 'ingreso' ? 'Fecha de ingreso' : 'Fecha de entrega' }, { key: 'tipo', label: 'Tipo' }, { key: 'etapa', label: 'Etapa' },
    { key: 'presupuesto', label: 'Presupuesto autorizado' }, { key: 'ampliacion', label: 'Ampliaciones' }, { key: 'particular', label: 'Presupuesto particular' }, { key: 'autorizado', label: 'Total autorizado' },
    ...GASTOS.map(([key, label]) => ({ key, label })), { key: 'suma', label: 'Suma de gastos' }, { key: 'iva', label: 'IVA' }, { key: 'total', label: 'Total gastos con IVA' },
    { key: 'porEntregar', label: 'Incluye material por entregar (estimado)' }, { key: 'ganancia', label: 'Ganancia (autorizado − suma)' }, { key: 'margen', label: 'Margen %' },
  ])

  const kpi = (l: string, v: number, cls = '') => <div className="card !p-4"><div className="text-xs text-slate-500">{l}</div><div className={`text-xl font-extrabold ${cls}`}>{money2(v)}</div></div>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
          {([['ingreso', 'Por fecha de ingreso'], ['entrega', 'Entregadas en el periodo']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setBase(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${base === k ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>{l}</button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm ml-auto" onClick={exportar}><Download className="h-4 w-4" /> Excel</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpi('Total autorizado', tot.autorizado)}
        {kpi('Suma de gastos', tot.suma, 'text-red-600')}
        {kpi('Ganancia', tot.ganancia, tot.ganancia >= 0 ? 'text-green-700' : 'text-red-600')}
        <div className="card !p-4"><div className="text-xs text-slate-500">Margen</div><div className={`text-xl font-extrabold ${margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{pct(margen)}</div><div className="text-[11px] text-slate-500">{rows?.length ?? 0} órdenes</div></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Autorizaciones">
          {([['Presupuestos', tot.presupuesto], ['Ampliaciones', tot.ampliacion], ['Presupuestos particulares', tot.particular]] as const).map(([l, v]) => (
            <div key={l} className="flex justify-between py-1 text-sm"><span>{l}</span><b>{money2(v)}</b></div>))}
          <div className="mt-1 flex justify-between border-t pt-2 text-sm font-bold"><span>Total autorizado</span><span>{money2(tot.autorizado)}</span></div>
        </Card>
        <Card title="Desglose de gastos">
          {GASTOS.map(([k, l]) => (
            <div key={k} className="flex justify-between gap-3 py-1 text-sm"><span>{l}</span><span className="flex items-center gap-2"><b>{money2(tot[k])}</b><span className="w-12 text-right text-xs text-slate-400">{tot.suma ? `${((tot[k] / tot.suma) * 100).toFixed(0)}%` : ''}</span></span></div>))}
          <div className="mt-1 flex justify-between border-t pt-2 text-sm font-bold"><span>Suma</span><span className="text-red-600">{money2(tot.suma)}</span></div>
          <div className="flex justify-between py-1 text-sm"><span>IVA (16%)</span><b>{money2(tot.iva)}</b></div>
          <div className="flex justify-between py-1 text-sm font-bold"><span>Total</span><span>{money2(tot.total)}</span></div>
          {tot.porEntregar > 0 && <p className="mt-1 text-[11px] text-amber-700">Incluye {money2(tot.porEntregar)} de material solicitado aún por entregar (costo estimado).</p>}
        </Card>
      </div>

      <Card pad={false} title={<span className="flex items-center gap-2 px-5 pt-4"><TrendingUp className="h-4 w-4 text-brand-600" /> Detalle por orden</span>}>
        {!rows ? <div className="esqueleto m-5 h-40" /> : rows.length === 0 ? <Empty>Sin órdenes en el periodo</Empty> : (
          <div className="overflow-x-auto"><table className="tbl text-[13px]">
            <thead><tr><th>Orden</th><th className="text-right">Presupuesto</th><th className="text-right">Ampliación</th><th className="text-right">Particular</th><th className="text-right">Autorizado</th>
              {GASTOS.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}<th className="text-right">Suma</th><th className="text-right">IVA</th><th className="text-right">Total</th><th className="text-right">Ganancia</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.orden_id}>
                <td><Link className="font-bold text-brand-700" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.folio}</Link><div className="flex items-center gap-1 text-[11px] text-slate-500">{r.tipo === 'aseguradora' ? 'Aseg.' : 'Part.'} · <Badge cls={ETAPAS[r.etapa]?.badge ?? ''}>{ETAPAS[r.etapa]?.label ?? r.etapa}</Badge></div></td>
                <td className="text-right">{money2(r.presupuesto)}</td><td className="text-right">{money2(r.ampliacion)}</td><td className="text-right">{money2(r.particular)}</td>
                <td className="text-right font-semibold">{money2(r.autorizado)}</td>
                {GASTOS.map(([k]) => <td key={k} className="text-right">{money2(r[k])}</td>)}
                <td className="text-right font-semibold text-red-600">{money2(r.suma)}</td><td className="text-right">{money2(r.iva)}</td><td className="text-right">{money2(r.total)}</td>
                <td className={`text-right font-bold ${r.ganancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money2(r.ganancia)}<div className="text-[11px] font-normal text-slate-500">{pct(r.margen)}</div></td>
              </tr>))}</tbody>
            <tfoot><tr className="font-bold"><td>Totales</td><td className="text-right">{money2(tot.presupuesto)}</td><td className="text-right">{money2(tot.ampliacion)}</td><td className="text-right">{money2(tot.particular)}</td><td className="text-right">{money2(tot.autorizado)}</td>
              {GASTOS.map(([k]) => <td key={k} className="text-right">{money2(tot[k])}</td>)}
              <td className="text-right text-red-600">{money2(tot.suma)}</td><td className="text-right">{money2(tot.iva)}</td><td className="text-right">{money2(tot.total)}</td><td className={`text-right ${tot.ganancia >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money2(tot.ganancia)}</td></tr></tfoot>
          </table></div>
        )}
      </Card>
      <p className="text-xs text-slate-400">Ganancia = total autorizado − suma de gastos (sin IVA). Gastos adicionales: servicios externos, otros gastos, mano de obra de pulido u otras áreas y pequeño material. Material entregado a costo real; material solicitado o autorizado aún sin entregar a costo estimado del catálogo; destajos validados no cancelados; servicios externos y otros gastos registrados en cada orden; pequeño material ({'$'}300 por orden por omisión, configurable en Parámetros).</p>
    </div>
  )
}
