import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePeriodo } from '../../lib/periodo'
import { AREAS, ESTADO_DESTAJO, ETAPAS, TIPOS_MATERIAL, errorTexto, fecha, money, money2, pct } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Rentabilidad, VOrden } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg } from '../../components/ui'
import { Barras } from '../../components/Graficas'
import PeriodoSelect from '../../components/PeriodoSelect'
import { DesgloseRentabilidad } from '../expediente/Costos'

const COLS_RENT = [
  { key: 'folio', label: 'Orden' }, { key: 'tipo', label: 'Tipo' }, { key: 'etapa', label: 'Etapa' }, { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'fecha_entrega', label: 'Entrega' },
  { key: 'autorizado', label: 'Autorizado' }, { key: 'adicional', label: 'Adicionales' }, { key: 'facturado', label: 'Facturado' }, { key: 'cobrado', label: 'Cobrado' },
  { key: 'costo_pintura', label: 'Pintura' }, { key: 'costo_materiales', label: 'Materiales' }, { key: 'costo_refacciones', label: 'Refacciones' }, { key: 'costo_destajos', label: 'Destajos' },
  { key: 'costo_mano_obra_adicional', label: 'MO adicional' }, { key: 'costo_servicios_externos', label: 'Externos' }, { key: 'costo_otros', label: 'Otros' },
  { key: 'costos_directos', label: 'Costos directos' }, { key: 'utilidad_bruta', label: 'Utilidad bruta' }, { key: 'indirectos_asignados', label: 'Indirectos' },
  { key: 'utilidad_estimada', label: 'Utilidad estimada' }, { key: 'por_cobrar', label: 'Por cobrar' },
]

const sum = (rows: Rentabilidad[], k: keyof Rentabilidad) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)

/* ------------------------------ RENTABILIDAD ------------------------------ */
export function TabRentabilidad() {
  const per = usePeriodo('mes')
  const [base, setBase] = useState<'entrega' | 'ingreso'>('entrega')
  const [tipo, setTipo] = useState('')
  const [rows, setRows] = useState<Rentabilidad[]>([])
  const [abierta, setAbierta] = useState<number | null>(null)
  useEffect(() => {
    const col = base === 'entrega' ? 'fecha_entrega' : 'fecha_ingreso'
    let q = supabase.from('v_rentabilidad').select('*').gte(col, per.desde).lt(col, per.hasta).neq('etapa', 'cancelado').order('folio', { ascending: false })
    if (base === 'entrega') q = q.eq('etapa', 'entregado')
    if (tipo) q = q.eq('tipo', tipo)
    q.then(({ data }) => setRows((data ?? []) as Rentabilidad[]))
  }, [per.desde, per.hasta, base, tipo])
  const ing = sum(rows, 'ingreso_reconocido'), ub = sum(rows, 'utilidad_bruta'), ue = sum(rows, 'utilidad_estimada')
  const perdida = rows.filter(r => r.utilidad_bruta < 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <select className="input w-auto" value={base} onChange={e => setBase(e.target.value as 'entrega' | 'ingreso')}><option value="entrega">Órdenes entregadas en el periodo</option><option value="ingreso">Órdenes ingresadas en el periodo</option></select>
        <select className="input w-auto" value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Aseguradora y particulares</option><option value="aseguradora">Aseguradora</option><option value="particular">Particulares</option></select>
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('rentabilidad', rows.map(r => ({ ...r, etapa: ETAPAS[r.etapa].label })) as unknown as Record<string, unknown>[], COLS_RENT)}><Download className="h-4 w-4" /> Excel</button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[['Órdenes', rows.length], ['Ingreso reconocido', money(ing)], ['Costos directos', money(sum(rows, 'costos_directos'))], ['Utilidad bruta', money(ub)], ['Utilidad después de indirectos', money(ue)]].map(([k, v]) => (
          <div key={k as string} className="card !p-4"><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-extrabold">{v}</div></div>
        ))}
      </div>
      {perdida.length > 0 && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{perdida.length} orden(es) con utilidad bruta negativa: {perdida.map(r => r.folio).join(', ')}</div>}
      <Card pad={false}>
        {rows.length === 0 ? <Empty>Sin órdenes en el periodo</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th></th><th>Orden</th><th>Tipo</th><th>Etapa</th><th className="text-right">Ingreso reconocido</th><th className="text-right">Facturado</th><th className="text-right">Cobrado</th><th className="text-right">Costos directos</th><th className="text-right">Utilidad bruta</th><th className="text-right">Margen</th><th className="text-right">Utilidad estimada</th></tr></thead>
            <tbody>{rows.map(r => {
              const m = r.ingreso_reconocido ? (r.utilidad_bruta / r.ingreso_reconocido) * 100 : NaN
              return (
                <Fragment key={r.orden_id}>
                  <tr className="cursor-pointer" onClick={() => setAbierta(abierta === r.orden_id ? null : r.orden_id)}>
                    <td>{abierta === r.orden_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td><Link className="font-bold text-brand-700 hover:underline" to={`/ordenes/${r.orden_id}?tab=costos`} onClick={e => e.stopPropagation()}>{r.folio}</Link></td>
                    <td className="text-xs">{r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'}</td>
                    <td><Badge cls={ETAPAS[r.etapa].badge}>{ETAPAS[r.etapa].label}</Badge></td>
                    <td className="text-right">{money(r.ingreso_reconocido)}</td><td className="text-right text-slate-500">{money(r.facturado)}</td><td className="text-right text-slate-500">{money(r.cobrado)}</td>
                    <td className="text-right">{money(r.costos_directos)}</td>
                    <td className={`text-right font-semibold ${r.utilidad_bruta < 0 ? 'text-red-600' : 'text-green-700'}`}>{money(r.utilidad_bruta)}</td>
                    <td className="text-right">{pct(m)}</td>
                    <td className={`text-right font-semibold ${r.utilidad_estimada < 0 ? 'text-red-600' : ''}`}>{money(r.utilidad_estimada)}</td>
                  </tr>
                  {abierta === r.orden_id && <tr><td colSpan={11} className="bg-slate-50 !p-5"><DesgloseRentabilidad r={r} /></td></tr>}
                </Fragment>)
            })}</tbody>
          </table></div>
        )}
      </Card>
      <p className="text-xs text-slate-500">Ingreso reconocido = presupuestos autorizados + ampliaciones autorizadas. Se muestran por separado lo facturado y lo efectivamente cobrado.</p>
    </div>
  )
}

/* ------------------------------ KPIs ASEGURADORA ------------------------------ */
interface AsigK { estatus: string; primer_contacto: string | null }
export function TabKpis() {
  const per = usePeriodo('mes')
  const [aseg, setAseg] = useState<{ id: number; nombre: string }[]>([])
  const [asegId, setAsegId] = useState('')
  const [asigs, setAsigs] = useState<AsigK[]>([])
  const [ingresadas, setIngresadas] = useState(0)
  const [entregadas, setEntregadas] = useState<VOrden[]>([])
  const [activasRetr, setActivasRetr] = useState<VOrden[]>([])
  const [mensual, setMensual] = useState<{ label: string; value: number; color: string }[]>([])
  const [cfg, setCfg] = useState<Record<string, number>>({})
  const [tipos, setTipos] = useState<{ nombre: string; dias_objetivo: number }[]>([])

  useEffect(() => {
    supabase.from('aseguradoras').select('id,nombre').then(({ data }) => { setAseg(data ?? []); if (data?.[0]) setAsegId(String(data[0].id)) })
    supabase.from('configuracion').select('clave,valor').then(({ data }) => setCfg(Object.fromEntries((data ?? []).map(c => [c.clave, Number(c.valor)]))))
  }, [])
  useEffect(() => {
    if (!asegId) return
    const { desde, hasta } = per
    supabase.from('asignaciones').select('estatus, primer_contacto').eq('aseguradora_id', asegId).gte('fecha_asignacion', desde).lt('fecha_asignacion', hasta).then(({ data }) => setAsigs(data ?? []))
    supabase.from('ordenes').select('id', { count: 'exact', head: true }).eq('aseguradora_id', asegId).gte('fecha_ingreso', desde).lt('fecha_ingreso', hasta).then(r => setIngresadas(r.count ?? 0))
    supabase.from('v_ordenes').select('*').eq('aseguradora_id', asegId).eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta).then(({ data }) => setEntregadas((data ?? []) as VOrden[]))
    supabase.from('v_ordenes').select('*').eq('aseguradora_id', asegId).eq('retrasado', true).then(({ data }) => setActivasRetr((data ?? []) as VOrden[]))
    supabase.from('tipos_reparacion').select('nombre,dias_objetivo').eq('aseguradora_id', asegId).eq('activo', true).order('dias_objetivo').then(({ data }) => setTipos(data ?? []))
    const ini = new Date(); ini.setMonth(ini.getMonth() - 5, 1)
    supabase.from('ordenes').select('fecha_entrega').eq('aseguradora_id', asegId).eq('etapa', 'entregado').gte('fecha_entrega', ini.toLocaleDateString('en-CA')).then(({ data }) => {
      const meses: { label: string; value: number; color: string }[] = []
      for (let i = 0; i < 6; i++) {
        const d = new Date(ini.getFullYear(), ini.getMonth() + i, 1)
        const n = (data ?? []).filter(o => { const f = new Date(o.fecha_entrega!); return f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth() }).length
        meses.push({ label: d.toLocaleDateString('es-MX', { month: 'short' }), value: n, color: '#15a050' })
      }
      setMensual(meses)
    })
  }, [asegId, per.desde, per.hasta]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = asigs.length
  const contactados = asigs.filter(a => a.primer_contacto).length
  const ingresadasDeAsig = asigs.filter(a => a.estatus === 'ingresado').length
  const conCompromiso = entregadas.filter(o => o.fecha_compromiso)
  const aTiempo = conCompromiso.filter(o => o.entregado_a_tiempo).length
  const tiempos = entregadas.filter(o => o.fecha_terminacion).map(o => (new Date(o.fecha_terminacion!).getTime() - new Date(o.fecha_ingreso).getTime()) / 86400000)
  const encuestas = entregadas.filter(o => o.satisfaccion)
  const satisf = encuestas.length ? encuestas.reduce((s, o) => s + (o.satisfaccion ?? 0), 0) / encuestas.length : NaN
  const motivos = Object.entries([...entregadas.filter(o => o.fecha_compromiso && !o.entregado_a_tiempo), ...activasRetr].reduce<Record<string, number>>((acc, o) => { const k = o.motivo_retraso?.trim() || 'Sin motivo registrado'; acc[k] = (acc[k] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])

  const kpi = (label: string, valor: number, objetivo: number | undefined, fmt: (n: number) => string, detalle: string) => {
    const ok = objetivo === undefined || isNaN(valor) ? null : valor >= objetivo
    return (
      <div className="card !p-4">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-2xl font-extrabold ${ok === false ? 'text-red-600' : ok ? 'text-green-700' : ''}`}>{isNaN(valor) ? '—' : fmt(valor)}</div>
        <div className="text-[11px] text-slate-400">{detalle}{objetivo !== undefined && ` · objetivo ${fmt(objetivo)}`}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <select className="input w-auto" value={asegId} onChange={e => setAsegId(e.target.value)}>{aseg.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpi('Asignaciones recibidas', total, undefined, n => String(n), 'en el periodo')}
        {kpi('Contacto exitoso', total ? (contactados / total) * 100 : NaN, cfg.objetivo_contacto_pct, n => `${n.toFixed(0)}%`, `${contactados} de ${total}`)}
        {kpi('Citas concretadas (ingresaron)', total ? (ingresadasDeAsig / total) * 100 : NaN, cfg.objetivo_citas_pct, n => `${n.toFixed(0)}%`, `${ingresadasDeAsig} de ${total}`)}
        {kpi('Vehículos ingresados', ingresadas, undefined, n => String(n), 'en el periodo')}
        {kpi('Tiempo promedio de reparación', tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : NaN, undefined, n => `${n.toFixed(1)} días`, 'ingreso → terminación')}
        {kpi('Entregas dentro del plazo', conCompromiso.length ? (aTiempo / conCompromiso.length) * 100 : NaN, cfg.objetivo_entrega_tiempo_pct, n => `${n.toFixed(0)}%`, `${aTiempo} de ${conCompromiso.length}`)}
        {kpi('Entregas retrasadas', conCompromiso.length - aTiempo, undefined, n => String(n), 'entregadas fuera de plazo')}
        {kpi('Retrasados en taller hoy', activasRetr.length, undefined, n => String(n), 'activos con compromiso vencido')}
        {kpi('Satisfacción del cliente', satisf, cfg.objetivo_satisfaccion, n => n.toFixed(2), 'promedio 1 a 5')}
        {kpi('Encuestas respondidas', entregadas.length ? (encuestas.length / entregadas.length) * 100 : NaN, undefined, n => `${n.toFixed(0)}%`, `${encuestas.length} de ${entregadas.length} entregas`)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Productividad mensual (vehículos entregados)" className="lg:col-span-2">
          {mensual.every(m => m.value === 0) ? <Empty>Sin entregas en los últimos 6 meses</Empty> : <Barras datos={mensual} />}
        </Card>
        <Card title="Motivos de retraso">
          {motivos.length === 0 ? <p className="text-sm text-slate-400">Sin retrasos</p> : (
            <ul className="space-y-1.5 text-sm">{motivos.map(([m, n]) => <li key={m} className="flex justify-between gap-2"><span className="text-slate-700">{m}</span><b>{n}</b></li>)}</ul>
          )}
        </Card>
      </div>
      <Card title="Plazos objetivo por tipo de reparación">
        {tipos.length === 0 ? <p className="text-sm text-slate-400">Sin plazos configurados</p> : <div className="flex flex-wrap gap-2">{tipos.map(t => <Badge key={t.nombre} cls="bg-slate-100 text-slate-700">{t.nombre}: {t.dias_objetivo} días</Badge>)}</div>}
        <p className="mt-2 text-xs text-slate-500">Objetivos y plazos se ajustan en Configuración → Plazos y parámetros, según el convenio vigente con la aseguradora.</p>
      </Card>
    </div>
  )
}

/* ------------------------------ FINANCIERO ------------------------------ */
interface Gasto { id: number; mes: string; concepto: string; monto: number }
export function TabFinanciero() {
  const { puede } = useAuth()
  const per = usePeriodo('mes')
  const [rows, setRows] = useState<Rentabilidad[]>([])
  const [hist, setHist] = useState<Rentabilidad[]>([])
  const [pendientes, setPendientes] = useState<Rentabilidad[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [gastosHist, setGastosHist] = useState<Gasto[]>([])
  const [fg, setFg] = useState({ concepto: '', monto: '' })
  const [error, setError] = useState<string | null>(null)
  const mesISO = per.desde.slice(0, 7) + '-01'

  const cargar = useCallback(() => {
    supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', per.desde).lt('fecha_entrega', per.hasta).then(({ data }) => setRows((data ?? []) as Rentabilidad[]))
    supabase.from('v_rentabilidad').select('*').gt('por_cobrar', 0).eq('etapa', 'entregado').order('fecha_entrega').then(({ data }) => setPendientes((data ?? []) as Rentabilidad[]))
    supabase.from('gastos_fijos').select('*').gte('mes', per.desde).lt('mes', per.hasta).order('id').then(({ data }) => setGastos((data ?? []) as Gasto[]))
    const ini = new Date(); ini.setMonth(ini.getMonth() - 5, 1)
    const iniISO = ini.toLocaleDateString('en-CA')
    supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', iniISO).then(({ data }) => setHist((data ?? []) as Rentabilidad[]))
    supabase.from('gastos_fijos').select('*').gte('mes', iniISO).then(({ data }) => setGastosHist((data ?? []) as Gasto[]))
  }, [per.desde, per.hasta])
  useEffect(() => { cargar() }, [cargar])

  const porTipo = (t: string) => rows.filter(r => r.tipo === t)
  const asegR = porTipo('aseguradora'), partR = porTipo('particular')
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const ingresos = sum(rows, 'ingreso_reconocido'), ub = sum(rows, 'utilidad_bruta')
  const margenContrib = ingresos ? ub / ingresos : 0
  const equilibrio = margenContrib > 0 ? totalGastos / margenContrib : NaN

  const meses = useMemo(() => {
    const ini = new Date(); ini.setMonth(ini.getMonth() - 5, 1)
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ini.getFullYear(), ini.getMonth() + i, 1)
      const delMes = hist.filter(r => { const f = new Date(r.fecha_entrega!); return f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth() })
      const gf = gastosHist.filter(g => g.mes.slice(0, 7) === d.toLocaleDateString('en-CA').slice(0, 7)).reduce((s, g) => s + Number(g.monto), 0)
      const ing = sum(delMes, 'ingreso_reconocido'), cd = sum(delMes, 'costos_directos')
      return { mes: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }), ordenes: delMes.length, ing, cd, ub: ing - cd, gf, neta: ing - cd - gf }
    })
  }, [hist, gastosHist])

  async function agregarGasto(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('gastos_fijos').insert({ mes: mesISO, concepto: fg.concepto, monto: Number(fg.monto) })
    if (error) return setError(errorTexto(error))
    setFg({ concepto: '', monto: '' }); setError(null); cargar()
  }

  const bloque = (titulo: string, rs: Rentabilidad[]) => (
    <div className="rounded-xl bg-slate-50 p-4 text-sm">
      <div className="mb-2 font-bold">{titulo} <span className="font-normal text-slate-500">({rs.length} órdenes)</span></div>
      {[['Ingresos', sum(rs, 'ingreso_reconocido')], ['Pintura y materiales', sum(rs, 'costo_pintura') + sum(rs, 'costo_materiales')], ['Refacciones', sum(rs, 'costo_refacciones')],
        ['Destajos y mano de obra', sum(rs, 'costo_destajos') + sum(rs, 'costo_mano_obra_adicional')], ['Externos y otros', sum(rs, 'costo_servicios_externos') + sum(rs, 'costo_otros')],
        ['Utilidad bruta', sum(rs, 'utilidad_bruta')], ['Utilidad promedio por vehículo', rs.length ? sum(rs, 'utilidad_bruta') / rs.length : 0]].map(([k, v]) => (
        <div key={k as string} className={`flex justify-between py-0.5 ${(k as string).startsWith('Utilidad') ? 'font-semibold' : ''}`}><span>{k}</span><span>{money(v)}</span></div>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
      <ErrorMsg error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {bloque('Ingresos por aseguradora (MAPFRE)', asegR)}
        {bloque('Ingresos por particulares', partR)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Gastos fijos y punto de equilibrio" className="lg:col-span-1">
          {gastos.length === 0 ? <p className="text-sm text-slate-400">Sin gastos fijos registrados en el periodo</p> : (
            <ul className="divide-y text-sm">{gastos.map(g => (
              <li key={g.id} className="flex justify-between py-1.5"><span>{g.concepto} <span className="text-xs text-slate-400">{fecha(g.mes).slice(3)}</span></span>
                <span className="flex gap-2">{money2(g.monto)}{puede('finanzas.gestionar') && <button className="text-xs text-red-500" onClick={async () => { if (confirm('¿Eliminar gasto?')) { await supabase.from('gastos_fijos').delete().eq('id', g.id); cargar() } }}>✕</button>}</span></li>))}
            </ul>
          )}
          {puede('finanzas.gestionar') && (
            <form onSubmit={agregarGasto} className="mt-3 grid grid-cols-[1fr_7rem_auto] gap-2">
              <input className="input" required placeholder="Renta, luz, nómina fija…" value={fg.concepto} onChange={e => setFg({ ...fg, concepto: e.target.value })} />
              <input className="input" type="number" step="0.01" min="0" required placeholder="Monto" value={fg.monto} onChange={e => setFg({ ...fg, monto: e.target.value })} />
              <button className="btn btn-primary">+</button>
              <p className="col-span-3 text-[11px] text-slate-400">Se registra en el mes {new Date(mesISO + 'T12:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}.</p>
            </form>
          )}
          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Gastos fijos del periodo</span><b>{money2(totalGastos)}</b></div>
            <div className="flex justify-between"><span>Margen de contribución</span><b>{pct(margenContrib * 100)}</b></div>
            <div className="flex justify-between text-base"><span>Punto de equilibrio (ventas)</span><b>{isNaN(equilibrio) ? '—' : money(equilibrio)}</b></div>
            <div className="flex justify-between"><span>Ventas del periodo</span><b className={ingresos >= equilibrio ? 'text-green-700' : 'text-red-600'}>{money(ingresos)}</b></div>
          </div>
        </Card>
        <Card title="Comparativo mensual (órdenes entregadas)" className="lg:col-span-2">
          <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
            <thead><tr><th>Mes</th><th className="text-right">Órdenes</th><th className="text-right">Ingresos</th><th className="text-right">Costos directos</th><th className="text-right">Utilidad bruta</th><th className="text-right">Gastos fijos</th><th className="text-right">Utilidad del mes</th></tr></thead>
            <tbody>{meses.map(m => (
              <tr key={m.mes}><td className="capitalize">{m.mes}</td><td className="text-right">{m.ordenes}</td><td className="text-right">{money(m.ing)}</td><td className="text-right">{money(m.cd)}</td>
                <td className="text-right">{money(m.ub)}</td><td className="text-right">{money(m.gf)}</td><td className={`text-right font-bold ${m.neta < 0 ? 'text-red-600' : 'text-green-700'}`}>{money(m.neta)}</td></tr>))}
            </tbody>
          </table></div>
        </Card>
      </div>
      <Card title={`Cuentas pendientes de cobro (${pendientes.length})`} action={<span className="text-lg font-extrabold text-red-600">{money(sum(pendientes, 'por_cobrar'))}</span>}>
        {pendientes.length === 0 ? <Empty>Sin vehículos entregados pendientes de cobro</Empty> : (
          <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
            <thead><tr><th>Orden</th><th>Tipo</th><th>Entrega</th><th className="text-right">Ingreso reconocido</th><th className="text-right">Facturado</th><th className="text-right">Cobrado</th><th className="text-right">Pendiente</th></tr></thead>
            <tbody>{pendientes.map(r => (
              <tr key={r.orden_id}><td><Link className="font-bold text-brand-700" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.folio}</Link></td><td className="text-xs">{r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'}</td>
                <td>{fecha(r.fecha_entrega)}</td><td className="text-right">{money(r.ingreso_reconocido)}</td><td className="text-right">{money(r.facturado)}</td><td className="text-right">{money(r.cobrado)}</td><td className="text-right font-bold text-red-600">{money(r.por_cobrar)}</td></tr>))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------ REPORTES ------------------------------ */
export function TabReportes() {
  const { puede } = useAuth()
  const per = usePeriodo('mes')
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { desde, hasta } = per

  const reportes: { id: string; t: string; d: string; permiso?: string; run: () => Promise<void> }[] = [
    { id: 'ordenes', t: 'Vehículos recibidos', d: 'Órdenes ingresadas en el periodo con etapa, fechas y responsables', run: async () => {
      const { data } = await supabase.from('v_ordenes').select('*').gte('fecha_ingreso', desde).lt('fecha_ingreso', hasta).order('folio')
      descargarCSV('reporte_ordenes', (data ?? []).map(o => ({ ...o, etapa: ETAPAS[o.etapa as keyof typeof ETAPAS].label })), [
        { key: 'folio', label: 'Folio' }, { key: 'tipo', label: 'Tipo' }, { key: 'aseguradora_nombre', label: 'Aseguradora' }, { key: 'siniestro', label: 'Siniestro' }, { key: 'cliente_nombre', label: 'Cliente' },
        { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'placas', label: 'Placas' }, { key: 'etapa', label: 'Etapa' }, { key: 'fecha_ingreso', label: 'Ingreso' },
        { key: 'fecha_compromiso', label: 'Compromiso' }, { key: 'fecha_terminacion', label: 'Terminación' }, { key: 'fecha_entrega', label: 'Entrega' }, { key: 'dias_en_taller', label: 'Días' }, { key: 'asesor_nombre', label: 'Asesor' }, { key: 'motivo_retraso', label: 'Motivo retraso' }])
    } },
    { id: 'productividad', t: 'Productividad de técnicos', d: 'Trabajos asignados en el periodo con tiempos, estado y retrabajos', run: async () => {
      const { data } = await supabase.from('actividades').select('*, tecnicos(nombre), ordenes(folio)').gte('fecha_asignacion', desde).lt('fecha_asignacion', hasta).order('fecha_asignacion')
      descargarCSV('reporte_productividad', (data ?? []).map(a => ({ ...a, tecnico: a.tecnicos?.nombre, folio: a.ordenes?.folio, area: AREAS[a.area] })), [
        { key: 'tecnico', label: 'Técnico' }, { key: 'folio', label: 'Orden' }, { key: 'area', label: 'Área' }, { key: 'actividad', label: 'Actividad' }, { key: 'pieza', label: 'Pieza' }, { key: 'estado', label: 'Estado' },
        { key: 'fecha_asignacion', label: 'Asignación' }, { key: 'fecha_inicio', label: 'Inicio' }, { key: 'fecha_fin', label: 'Fin' }, { key: 'horas', label: 'Horas' }, { key: 'rechazos', label: 'Retrabajos' }, { key: 'importe_destajo', label: 'Destajo' }])
    } },
    { id: 'destajos', t: 'Destajos', d: 'Generados en el periodo, separados por aseguradora/particular', permiso: 'destajos.ver', run: async () => {
      const { data } = await supabase.from('destajos').select('*, tecnicos(nombre), ordenes(folio), actividades(actividad,pieza)').gte('generado_at', desde).lt('generado_at', hasta).order('tipo').order('generado_at')
      descargarCSV('reporte_destajos', (data ?? []).map(d => ({ ...d, tecnico: d.tecnicos?.nombre, folio: d.ordenes?.folio, actividad: d.actividades?.actividad, estado: ESTADO_DESTAJO[d.estado].label })), [
        { key: 'tipo', label: 'Tipo' }, { key: 'tecnico', label: 'Técnico' }, { key: 'folio', label: 'Orden' }, { key: 'actividad', label: 'Actividad' }, { key: 'importe', label: 'Importe' }, { key: 'estado', label: 'Estado' },
        { key: 'generado_at', label: 'Generado' }, { key: 'autorizado_at', label: 'Autorizado' }, { key: 'pagado_at', label: 'Pagado' }, { key: 'referencia_pago', label: 'Referencia' }])
    } },
    { id: 'consumo', t: 'Compras y consumo', d: 'Entregas de material del periodo con costo cargado a cada orden', run: async () => {
      const { data } = await supabase.from('solicitudes_material').select('*, materiales(codigo,descripcion,unidad,tipo), ordenes(folio)').eq('estado', 'entregada').gte('entregado_at', desde).lt('entregado_at', hasta).order('entregado_at')
      descargarCSV('reporte_consumo', (data ?? []).map(s => ({ ...s, codigo: s.materiales?.codigo, material: s.materiales?.descripcion, unidad: s.materiales?.unidad, tipo_material: TIPOS_MATERIAL[s.materiales?.tipo ?? ''], destino: s.ordenes?.folio ?? `General: ${s.centro_costo}` })), [
        { key: 'entregado_at', label: 'Fecha' }, { key: 'destino', label: 'Orden / centro de costo' }, { key: 'codigo', label: 'Código' }, { key: 'material', label: 'Material' }, { key: 'tipo_material', label: 'Tipo' },
        { key: 'cantidad_entregada', label: 'Cantidad' }, { key: 'unidad', label: 'Unidad' }, { key: 'costo_unit', label: 'Costo unit.' }, { key: 'costo_total', label: 'Costo total' }])
    } },
    { id: 'inventario', t: 'Inventarios', d: 'Existencias actuales, mínimos y valor a costo promedio', run: async () => {
      const { data } = await supabase.from('materiales').select('*').order('descripcion')
      descargarCSV('reporte_inventario', (data ?? []).map(m => ({ ...m, tipo: TIPOS_MATERIAL[m.tipo], valor: (Number(m.existencia) * Number(m.costo_promedio)).toFixed(2), bajo_minimo: Number(m.existencia) <= Number(m.minimo) ? 'Sí' : 'No' })), [
        { key: 'codigo', label: 'Código' }, { key: 'descripcion', label: 'Descripción' }, { key: 'tipo', label: 'Tipo' }, { key: 'categoria', label: 'Categoría' }, { key: 'unidad', label: 'Unidad' },
        { key: 'existencia', label: 'Existencia' }, { key: 'minimo', label: 'Mínimo' }, { key: 'bajo_minimo', label: 'Bajo mínimo' }, { key: 'costo_promedio', label: 'Costo promedio' }, { key: 'valor', label: 'Valor' }])
    } },
    { id: 'rentabilidad', t: 'Rentabilidad', d: 'Órdenes entregadas en el periodo con ingresos, costos y utilidad', permiso: 'finanzas.ver', run: async () => {
      const { data } = await supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta).order('folio')
      descargarCSV('reporte_rentabilidad', (data ?? []) as Record<string, unknown>[], COLS_RENT)
    } },
    { id: 'tiempos', t: 'Tiempos de entrega', d: 'Entregas del periodo: días en taller, compromiso y cumplimiento', run: async () => {
      const { data } = await supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta).order('fecha_entrega')
      descargarCSV('reporte_tiempos_entrega', (data ?? []).map(o => ({ ...o, a_tiempo: o.entregado_a_tiempo ? 'Sí' : 'No' })), [
        { key: 'folio', label: 'Folio' }, { key: 'tipo', label: 'Tipo' }, { key: 'aseguradora_nombre', label: 'Aseguradora' }, { key: 'tipo_reparacion_nombre', label: 'Tipo reparación' },
        { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'fecha_compromiso', label: 'Compromiso' }, { key: 'fecha_terminacion', label: 'Terminación' }, { key: 'fecha_entrega', label: 'Entrega' },
        { key: 'dias_en_taller', label: 'Días' }, { key: 'a_tiempo', label: 'Dentro de plazo' }, { key: 'motivo_retraso', label: 'Motivo retraso' }, { key: 'satisfaccion', label: 'Satisfacción' }])
    } },
    { id: 'entregados', t: 'Vehículos entregados', d: 'Entregas del periodo con cliente, aseguradora, días y satisfacción', run: async () => {
      const { data } = await supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta).order('fecha_entrega')
      descargarCSV('reporte_entregados', (data ?? []) as Record<string, unknown>[], [
        { key: 'folio', label: 'Folio' }, { key: 'aseguradora_nombre', label: 'Aseguradora' }, { key: 'siniestro', label: 'Siniestro' }, { key: 'cliente_nombre', label: 'Cliente' },
        { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'placas', label: 'Placas' }, { key: 'fecha_ingreso', label: 'Ingreso' },
        { key: 'fecha_entrega', label: 'Entrega' }, { key: 'dias_en_taller', label: 'Días' }, { key: 'recibio_nombre', label: 'Recibió' }, { key: 'satisfaccion', label: 'Satisfacción' }])
    } },
    { id: 'abiertas', t: 'Órdenes abiertas y cerradas', d: 'Situación actual de todas las órdenes: abiertas por etapa y cerradas', run: async () => {
      const { data } = await supabase.from('v_ordenes').select('*').order('folio')
      descargarCSV('reporte_ordenes_abiertas_cerradas', (data ?? []).map(o => ({ ...o, estado: ['entregado', 'cancelado'].includes(o.etapa) ? 'Cerrada' : 'Abierta', etapa: ETAPAS[o.etapa as keyof typeof ETAPAS].label, retrasado: o.retrasado ? 'Sí' : 'No' })), [
        { key: 'folio', label: 'Folio' }, { key: 'estado', label: 'Estado' }, { key: 'etapa', label: 'Etapa' }, { key: 'tipo', label: 'Tipo' }, { key: 'aseguradora_nombre', label: 'Aseguradora' },
        { key: 'cliente_nombre', label: 'Cliente' }, { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'fecha_compromiso', label: 'Compromiso' }, { key: 'retrasado', label: 'Retrasado' }, { key: 'dias_en_taller', label: 'Días' }])
    } },
    { id: 'compras', t: 'Compras', d: 'Compras del periodo por proveedor, estado, factura y total', permiso: 'compras.gestionar', run: async () => {
      const { data } = await supabase.from('compras').select('*, proveedores(nombre), compra_partidas(cantidad, costo_unit)').gte('fecha', desde).lt('fecha', hasta).order('fecha')
      descargarCSV('reporte_compras', (data ?? []).map(c => ({ ...c, folio: 'REQ-' + String(c.id).padStart(4, '0'), proveedor: c.proveedores?.nombre, total: c.compra_partidas.reduce((t: number, p: { cantidad: number; costo_unit: number }) => t + p.cantidad * p.costo_unit, 0).toFixed(2) })), [
        { key: 'folio', label: 'Folio' }, { key: 'fecha', label: 'Fecha' }, { key: 'proveedor', label: 'Proveedor' }, { key: 'estado', label: 'Estado' }, { key: 'total', label: 'Total recibido' },
        { key: 'factura', label: 'Factura' }, { key: 'factura_monto', label: 'Importe factura' }, { key: 'factura_fecha', label: 'Fecha factura' }])
    } },
    { id: 'rent_mensual', t: 'Rentabilidad mensual', d: 'Ingresos, costos y utilidad por mes (órdenes entregadas), separado por tipo de servicio', permiso: 'finanzas.ver', run: async () => {
      const { data } = await supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta)
      const g: Record<string, { mes: string; tipo: string; ordenes: number; ingresos: number; costos: number; utilidad_bruta: number; indirectos: number; utilidad_estimada: number }> = {}
      for (const r of (data ?? []) as Rentabilidad[]) {
        const k = `${r.fecha_entrega!.slice(0, 7)}|${r.tipo}`
        g[k] ??= { mes: r.fecha_entrega!.slice(0, 7), tipo: r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular', ordenes: 0, ingresos: 0, costos: 0, utilidad_bruta: 0, indirectos: 0, utilidad_estimada: 0 }
        g[k].ordenes++; g[k].ingresos += Number(r.ingreso_reconocido); g[k].costos += Number(r.costos_directos); g[k].utilidad_bruta += Number(r.utilidad_bruta); g[k].indirectos += Number(r.indirectos_asignados); g[k].utilidad_estimada += Number(r.utilidad_estimada)
      }
      descargarCSV('reporte_rentabilidad_mensual', Object.values(g).sort((a, b) => a.mes.localeCompare(b.mes)).map(x => ({ ...x, margen: x.ingresos ? ((x.utilidad_bruta / x.ingresos) * 100).toFixed(1) + '%' : '' })))
    } },
    { id: 'servicios', t: 'Servicios MAPFRE y particulares', d: 'Órdenes ingresadas en el periodo por tipo de servicio, con montos autorizados', permiso: 'finanzas.ver', run: async () => {
      const { data } = await supabase.from('v_rentabilidad').select('*').gte('fecha_ingreso', desde).lt('fecha_ingreso', hasta).neq('etapa', 'cancelado').order('tipo').order('folio')
      descargarCSV('reporte_servicios_por_tipo', ((data ?? []) as Rentabilidad[]).map(r => ({ ...r, tipo: r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular', etapa: ETAPAS[r.etapa].label })) as unknown as Record<string, unknown>[], [
        { key: 'tipo', label: 'Tipo' }, { key: 'folio', label: 'Orden' }, { key: 'etapa', label: 'Etapa' }, { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'ingreso_reconocido', label: 'Autorizado' },
        { key: 'facturado', label: 'Facturado' }, { key: 'cobrado', label: 'Cobrado' }, { key: 'costos_directos', label: 'Costos' }, { key: 'utilidad_bruta', label: 'Utilidad bruta' }])
    } },
    { id: 'retrasos', t: 'Retrasos y sus causas', d: 'Órdenes retrasadas activas y entregas fuera de plazo con su motivo', run: async () => {
      const [act, ent] = await Promise.all([
        supabase.from('v_ordenes').select('*').eq('retrasado', true),
        supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').eq('entregado_a_tiempo', false).not('fecha_compromiso', 'is', null).gte('fecha_entrega', desde).lt('fecha_entrega', hasta),
      ])
      const filas = [...(act.data ?? []).map(o => ({ ...o, situacion: 'Activa retrasada' })), ...(ent.data ?? []).map(o => ({ ...o, situacion: 'Entregada fuera de plazo' }))]
      descargarCSV('reporte_retrasos', filas.map(o => ({ ...o, etapa: ETAPAS[o.etapa as keyof typeof ETAPAS].label, motivo: o.motivo_retraso ?? 'Sin motivo registrado', dias_retraso: Math.max(0, Math.floor(((o.fecha_entrega ? new Date(o.fecha_entrega).getTime() : Date.now()) - new Date(o.fecha_compromiso + 'T23:59:59').getTime()) / 86400000)) })), [
        { key: 'folio', label: 'Folio' }, { key: 'situacion', label: 'Situación' }, { key: 'etapa', label: 'Etapa' }, { key: 'aseguradora_nombre', label: 'Aseguradora' }, { key: 'fecha_compromiso', label: 'Compromiso' },
        { key: 'fecha_entrega', label: 'Entrega' }, { key: 'dias_retraso', label: 'Días de retraso' }, { key: 'motivo', label: 'Motivo' }, { key: 'detenido_material', label: 'Detenido por material' }])
    } },
    { id: 'encuestas', t: 'Encuestas y satisfacción', d: 'Entregas del periodo con calificación y comentarios del cliente', run: async () => {
      const { data } = await supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta).order('fecha_entrega')
      descargarCSV('reporte_encuestas', (data ?? []).map(o => ({ ...o, respondida: o.satisfaccion ? 'Sí' : 'No' })), [
        { key: 'folio', label: 'Folio' }, { key: 'cliente_nombre', label: 'Cliente' }, { key: 'aseguradora_nombre', label: 'Aseguradora' }, { key: 'fecha_entrega', label: 'Entrega' },
        { key: 'respondida', label: 'Respondida' }, { key: 'satisfaccion', label: 'Calificación (1-5)' }, { key: 'encuesta_comentario', label: 'Comentario' }])
    } },
    { id: 'aseguradora', t: 'Indicadores por aseguradora', d: 'Asignaciones del periodo con estatus de contacto, citas e ingreso', run: async () => {
      const { data } = await supabase.from('asignaciones').select('*, aseguradoras(nombre), perfiles(nombre)').gte('fecha_asignacion', desde).lt('fecha_asignacion', hasta).order('fecha_asignacion')
      descargarCSV('reporte_asignaciones', (data ?? []).map(a => ({ ...a, aseguradora: a.aseguradoras?.nombre, asesor: a.perfiles?.nombre, contactado: a.primer_contacto ? 'Sí' : 'No' })), [
        { key: 'aseguradora', label: 'Aseguradora' }, { key: 'siniestro', label: 'Siniestro' }, { key: 'asegurado', label: 'Asegurado' }, { key: 'fecha_asignacion', label: 'Asignación' },
        { key: 'asesor', label: 'Asesor' }, { key: 'estatus', label: 'Estatus' }, { key: 'contactado', label: 'Contactado' }, { key: 'primer_contacto', label: 'Primer contacto' }, { key: 'intentos', label: 'Intentos' },
        { key: 'fecha_cita', label: 'Cita' }, { key: 'motivo_no_cita', label: 'Motivo sin cita' }])
    } },
  ]

  async function ejecutar(r: typeof reportes[number]) {
    setCargando(r.id); setError(null)
    try { await r.run() } catch (e) { setError(errorTexto(e)) }
    setCargando(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <span className="text-xs text-slate-500">Los archivos se descargan en formato CSV, que se abre directamente en Excel.</span>
      </div>
      <ErrorMsg error={error} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {reportes.filter(r => !r.permiso || puede(r.permiso)).map(r => (
          <div key={r.id} className="card flex flex-col !p-4">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            <div className="mt-2 font-bold">{r.t}</div>
            <div className="flex-1 text-xs text-slate-500">{r.d}</div>
            <button className="btn btn-secondary btn-sm mt-3" disabled={cargando === r.id} onClick={() => ejecutar(r)}><Download className="h-4 w-4" /> {cargando === r.id ? 'Generando…' : 'Descargar Excel'}</button>
          </div>
        ))}
      </div>
      <Card title="PDF">
        <p className="text-sm text-slate-600">Para obtener un PDF, abre la pestaña o el expediente que necesitas y usa <b>Imprimir → Guardar como PDF</b>. El diseño de impresión oculta menús y botones.</p>
        <button className="btn btn-secondary btn-sm mt-3" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir esta página</button>
        <p className="mt-3 text-xs text-slate-400">Pendiente de implementar: plantillas PDF con formato propio (logotipo, encabezados) para cada reporte.</p>
      </Card>
    </div>
  )
}
