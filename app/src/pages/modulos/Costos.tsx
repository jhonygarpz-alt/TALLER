import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, Scale, TrendingUp, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePeriodo } from '../../lib/periodo'
import { ETAPAS, money, pct } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Rentabilidad } from '../../lib/tipos'
import { Badge, Card, Empty, PageHeader, SinPermiso, Tabs, useTab } from '../../components/ui'
import PeriodoSelect from '../../components/PeriodoSelect'
import { TabFinanciero, TabRentabilidad } from '../resultados/analisis'

interface Partida { concepto: string; cantidad: number; costo_unit: number; presupuestos: { orden_id: number; estado: string } }

const RUBROS = [
  { id: 'pintura', label: 'Pintura', real: (r: Rentabilidad) => Number(r.costo_pintura) },
  { id: 'material', label: 'Materiales', real: (r: Rentabilidad) => Number(r.costo_materiales) },
  { id: 'refaccion', label: 'Refacciones', real: (r: Rentabilidad) => Number(r.costo_refacciones) },
  { id: 'mano_obra', label: 'Mano de obra', real: (r: Rentabilidad) => Number(r.costo_destajos) + Number(r.costo_mano_obra_adicional) },
  { id: 'externo', label: 'Servicios externos', real: (r: Rentabilidad) => Number(r.costo_servicios_externos) },
] as const

/** Compara el costo estimado del presupuesto autorizado contra el costo real cargado a cada orden */
function PresupuestoVsReal() {
  const per = usePeriodo('anio')
  const [rows, setRows] = useState<Rentabilidad[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [tolerancia, setTolerancia] = useState(15)
  const [soloAlertas, setSoloAlertas] = useState(false)

  useEffect(() => {
    supabase.from('v_rentabilidad').select('*').gte('fecha_ingreso', per.desde).lt('fecha_ingreso', per.hasta).neq('etapa', 'cancelado').order('folio', { ascending: false })
      .then(async ({ data }) => {
        const rs = (data ?? []) as Rentabilidad[]
        setRows(rs)
        if (!rs.length) { setPartidas([]); return }
        const { data: ps } = await supabase.from('presupuesto_partidas').select('concepto, cantidad, costo_unit, presupuestos!inner(orden_id, estado)')
          .eq('presupuestos.estado', 'autorizado').in('presupuestos.orden_id', rs.map(r => r.orden_id))
        setPartidas((ps ?? []) as unknown as Partida[])
      })
  }, [per.desde, per.hasta])

  const datos = useMemo(() => rows.map(r => {
    const pres: Record<string, number> = {}
    for (const p of partidas.filter(x => x.presupuestos.orden_id === r.orden_id)) pres[p.concepto] = (pres[p.concepto] ?? 0) + Number(p.cantidad) * Number(p.costo_unit)
    const rubros = RUBROS.map(ru => {
      const est = pres[ru.id] ?? 0, real = ru.real(r)
      const exceso = est > 0 ? ((real - est) / est) * 100 : 0
      // Solo se alerta cuando hay costo estimado contra el cual comparar
      return { ...ru, est, real, exceso, alerta: est > 0 && exceso > tolerancia }
    })
    const totalEst = rubros.reduce((s, x) => s + x.est, 0), totalReal = rubros.reduce((s, x) => s + x.real, 0)
    const margen = r.ingreso_reconocido ? (r.utilidad_bruta / r.ingreso_reconocido) * 100 : NaN
    const motivos = [
      ...(r.utilidad_bruta < 0 ? ['Margen negativo'] : []),
      ...rubros.filter(x => x.alerta).map(x => `${x.label} +${x.exceso.toFixed(0)}%`),
    ]
    return { r, rubros, totalEst, totalReal, margen, motivos }
  }), [rows, partidas, tolerancia])

  const lista = soloAlertas ? datos.filter(d => d.motivos.length) : datos
  const conAlerta = datos.filter(d => d.motivos.length).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <label className="flex items-center gap-1 text-sm">Tolerancia <input type="number" min={0} className="input w-20 py-1.5" value={tolerancia} onChange={e => setTolerancia(Number(e.target.value))} />%</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={soloAlertas} onChange={e => setSoloAlertas(e.target.checked)} /> Solo órdenes con alerta ({conAlerta})</label>
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('presupuesto_vs_real', datos.flatMap(d => d.rubros.map(x => ({ orden: d.r.folio, tipo: d.r.tipo, rubro: x.label, presupuestado: x.est.toFixed(2), real: x.real.toFixed(2), diferencia: (x.real - x.est).toFixed(2), alerta: x.alerta ? 'Sí' : 'No' }))))}><Download className="h-4 w-4" /> Excel</button>
      </div>
      {lista.length === 0 ? <Card><Empty icon={Scale}>{soloAlertas ? 'Sin órdenes con desviaciones en el periodo' : 'Sin órdenes en el periodo'}</Empty></Card> : (
        <div className="space-y-3">
          {lista.map(d => (
            <Card key={d.r.orden_id} className={d.motivos.length ? 'border-red-200' : ''}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link to={`/ordenes/${d.r.orden_id}?tab=costos`} className="text-lg font-bold text-blue-600 hover:underline">{d.r.folio}</Link>
                <Badge cls={ETAPAS[d.r.etapa].badge}>{ETAPAS[d.r.etapa].label}</Badge>
                <span className="text-xs text-slate-500">{d.r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'}</span>
                {d.motivos.map(m => <Badge key={m} cls="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3" /> {m}</Badge>)}
                <span className="ml-auto text-sm">Margen bruto <b className={d.margen < 0 ? 'text-red-600' : 'text-green-700'}>{pct(d.margen)}</b></span>
              </div>
              <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
                <thead><tr><th>Rubro</th><th className="text-right">Presupuestado (costo)</th><th className="text-right">Real</th><th className="text-right">Diferencia</th><th className="text-right">Desviación</th></tr></thead>
                <tbody>{d.rubros.filter(x => x.est || x.real).map(x => (
                  <tr key={x.id}>
                    <td>{x.label}</td><td className="text-right">{money(x.est)}</td><td className="text-right">{money(x.real)}</td>
                    <td className={`text-right ${x.real - x.est > 0 ? 'text-red-600' : 'text-green-700'}`}>{money(x.real - x.est)}</td>
                    <td className="text-right">{x.est > 0 ? <span className={x.alerta ? 'font-bold text-red-600' : ''}>{x.exceso > 0 ? '+' : ''}{x.exceso.toFixed(1)}%</span> : x.real > 0 ? <span className="text-slate-400">Sin costo estimado</span> : '—'}</td>
                  </tr>))}
                </tbody>
                <tfoot><tr><td className="font-bold">Total</td><td className="text-right font-bold">{money(d.totalEst)}</td><td className="text-right font-bold">{money(d.totalReal)}</td><td className={`text-right font-bold ${d.totalReal - d.totalEst > 0 ? 'text-red-600' : 'text-green-700'}`}>{money(d.totalReal - d.totalEst)}</td><td /></tr></tfoot>
              </table></div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">Presupuestado = cantidad × costo estimado de las partidas autorizadas (incluye ampliaciones). Real = entregas de almacén, compras directas, destajos y costos registrados en la orden. Una desviación es una señal para revisar, no una conclusión.</p>
    </div>
  )
}

export default function Costos() {
  const { puede } = useAuth()
  const tab = useTab('rentabilidad')
  if (!puede('finanzas.ver')) return <SinPermiso que="costos y rentabilidad" />
  return (
    <div>
      <PageHeader title="Costos y rentabilidad" subtitle="Utilidad por orden, presupuesto contra costo real e indicadores financieros" />
      <Tabs tabs={[
        { id: 'rentabilidad', label: 'Rentabilidad por orden', icon: TrendingUp },
        { id: 'comparativo', label: 'Presupuesto vs real', icon: Scale },
        { id: 'financiero', label: 'Indicadores financieros', icon: Wallet },
      ]} />
      {tab === 'rentabilidad' && <TabRentabilidad />}
      {tab === 'comparativo' && <PresupuestoVsReal />}
      {tab === 'financiero' && <TabFinanciero />}
    </div>
  )
}
