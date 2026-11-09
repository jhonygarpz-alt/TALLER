import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarCheck, CalendarClock, Car, CheckCircle2, ChevronRight, ClipboardList, Clock, Coins, FileText, Gauge,
  Hammer, HardHat, Inbox, PackageX, Paintbrush, PhoneOff, PieChart, Plus, Receipt, Search, ShoppingCart, Sparkles, TrendingUp, Truck, User, Wallet, Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAlertas } from '../lib/alertas'
import { usePeriodo, type PeriodoId } from '../lib/periodo'
import { ETAPAS, fecha, hoyISO, money, pct, type Etapa } from '../lib/format'
import { vehiculoTxt, type Rentabilidad, type VOrden } from '../lib/tipos'
import { Badge, Card, Empty, KpiCard, PageHeader, TableWrap } from '../components/ui'
import { BarrasERP, ChartContainer, DonaERP, LineasDobles, MedidorERP, P, SERIE_ERP, VerMas } from '../components/GraficasERP'
import { Miniatura } from '../components/Fotos'
import PeriodoSelect from '../components/PeriodoSelect'

const GRUPOS: { label: string; etapas: Etapa[]; color: string; filtro: string }[] = [
  { label: 'Recepción / diagnóstico', etapas: ['recepcion', 'diagnostico', 'esperando_autorizacion'], color: P.ambar, filtro: 'etapa:recepcion,diagnostico,esperando_autorizacion' },
  { label: 'En reparación', etapas: ['en_reparacion'], color: P.azul, filtro: 'etapa:en_reparacion' },
  { label: 'Hojalatería', etapas: ['hojalateria'], color: P.petroleo, filtro: 'etapa:hojalateria' },
  { label: 'Preparación / pintura', etapas: ['preparacion', 'pintura'], color: P.turquesa, filtro: 'etapa:preparacion,pintura' },
  { label: 'Detallado / calidad', etapas: ['detallado', 'control_calidad'], color: P.cian, filtro: 'etapa:detallado,control_calidad' },
  { label: 'Listos para entrega', etapas: ['listo_entrega'], color: P.verde, filtro: 'etapa:listo_entrega' },
]

export function EtapaBadge({ o }: { o: Pick<VOrden, 'etapa' | 'retrasado'> }) {
  if (o.retrasado) return <Badge cls="bg-red-50 text-red-700 ring-1 ring-red-200">Retrasado · {ETAPAS[o.etapa].label}</Badge>
  return <Badge cls={ETAPAS[o.etapa].badge}>{ETAPAS[o.etapa].label}</Badge>
}

/* ---------- utilidades de fechas (locales) ---------- */
const dia = (ts: string | null | undefined) => ts ? new Date(ts).toLocaleDateString('en-CA') : null
const enRango = (d: string | null, desde: string, hasta: string) => !!d && d >= desde && d < hasta
function mover(iso: string, meses: number, dias = 0) {
  const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + meses); d.setDate(d.getDate() + dias); return d.toLocaleDateString('en-CA')
}
/** Periodo anterior equivalente, para el comparativo (null si no aplica) */
function anterior(p: PeriodoId, desde: string, hasta: string) {
  if (p === 'mes' || p === 'mes_anterior') return { desde: mover(desde, -1), hasta: mover(hasta, -1) }
  if (p === '30d') return { desde: mover(desde, 0, -30), hasta: mover(hasta, 0, -30) }
  if (p === 'anio') return { desde: mover(desde, -12), hasta: mover(hasta, -12) }
  return null
}
const variacion = (act: number, prev: number | null | undefined) => prev == null || prev === 0 ? null : ((act - prev) / Math.abs(prev)) * 100
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

type OrdenMin = Pick<VOrden, 'id' | 'tipo' | 'aseguradora_nombre' | 'fecha_ingreso' | 'fecha_entrega' | 'etapa' | 'entregado_a_tiempo' | 'fecha_compromiso'>
interface ActMin { estado: string; fecha_fin: string | null; tecnicos: { nombre: string } | null }

export default function Inicio() {
  const { puede } = useAuth()
  const a = useAlertas()
  const nav = useNavigate()
  const per = usePeriodo('mes')
  const prev = anterior(per.periodo, per.desde, per.hasta)
  const [asignadas, setAsignadas] = useState(0)
  const [citas, setCitas] = useState(0)
  const [pendientes, setPendientes] = useState(0)
  const [ordenes, setOrdenes] = useState<OrdenMin[] | null>(null)
  const [acts, setActs] = useState<ActMin[] | null>(null)
  const [rentTodo, setRentTodo] = useState<Rentabilidad[]>([])
  const [cobrado, setCobrado] = useState(0)
  const verFin = puede('finanzas.ver')
  const desdeConsulta = prev?.desde ?? per.desde

  useEffect(() => {
    const { desde, hasta } = per
    supabase.from('asignaciones').select('id', { count: 'exact', head: true }).gte('fecha_asignacion', desde).lt('fecha_asignacion', hasta)
      .then(r => setAsignadas(r.count ?? 0))
    supabase.from('asignaciones').select('id', { count: 'exact', head: true }).eq('estatus', 'cita_programada').then(r => setCitas(r.count ?? 0))
    supabase.from('actividades').select('id', { count: 'exact', head: true }).in('estado', ['asignada', 'en_proceso', 'terminada']).then(r => setPendientes(r.count ?? 0))
    supabase.from('v_ordenes').select('id,tipo,aseguradora_nombre,fecha_ingreso,fecha_entrega,etapa,entregado_a_tiempo,fecha_compromiso').neq('etapa', 'cancelado').limit(5000)
      .then(({ data }) => setOrdenes((data ?? []) as OrdenMin[]))
    supabase.from('actividades').select('estado, fecha_fin, tecnicos(nombre)').in('estado', ['terminada', 'validada']).gte('fecha_fin', desdeConsulta).limit(5000)
      .then(({ data }) => setActs((data ?? []) as unknown as ActMin[]))
    if (verFin) {
      supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desdeConsulta).lt('fecha_entrega', hasta)
        .then(({ data }) => setRentTodo((data ?? []) as Rentabilidad[]))
      supabase.from('cobros').select('monto').gte('fecha', desde).lt('fecha', hasta)
        .then(({ data }) => setCobrado((data ?? []).reduce((s, r) => s + Number(r.monto), 0)))
    }
  }, [per.desde, per.hasta, verFin, desdeConsulta]) // eslint-disable-line react-hooks/exhaustive-deps

  const sieteDias = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
  const cuenta = (etapas: Etapa[]) => a.activas.filter(o => etapas.includes(o.etapa)).length
  const dona = GRUPOS.map(g => ({ label: g.label, valor: cuenta(g.etapas), color: g.color, to: `/ordenes?filtro=${g.filtro}` }))
  const particulares = a.activas.filter(o => o.tipo === 'particular').length

  /* ----- finanzas del periodo y del anterior (mismo cálculo que antes) ----- */
  const resumen = (rs: Rentabilidad[]) => {
    const s = (k: keyof Rentabilidad) => rs.reduce((t, r) => t + Number(r[k] ?? 0), 0)
    const ingresos = s('ingreso_reconocido')
    const materiales = s('costo_pintura') + s('costo_materiales') + s('costo_refacciones')
    const manoObra = s('costo_destajos') + s('costo_mano_obra_adicional')
    const otros = s('costo_servicios_externos') + s('costo_otros')
    const indirectos = s('indirectos_asignados')
    const utilidad = ingresos - materiales - manoObra - otros - indirectos
    return { ingresos, materiales, manoObra, otros, indirectos, utilidad, costos: materiales + manoObra + otros, margen: ingresos ? (utilidad / ingresos) * 100 : NaN,
      pintura: s('costo_pintura'), mat: s('costo_materiales'), refacciones: s('costo_refacciones') }
  }
  const rent = useMemo(() => rentTodo.filter(r => enRango(dia(r.fecha_entrega), per.desde, per.hasta)), [rentTodo, per.desde, per.hasta])
  const fin = useMemo(() => ({ ...resumen(rent), pctInd: rent[0]?.indirectos_pct ?? a.config.indirectos_pct }), [rent, a.config.indirectos_pct]) // eslint-disable-line react-hooks/exhaustive-deps
  const finPrev = useMemo(() => prev ? resumen(rentTodo.filter(r => enRango(dia(r.fecha_entrega), prev.desde, prev.hasta))) : null, [rentTodo, prev?.desde, prev?.hasta]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- operación del periodo ----- */
  const op = useMemo(() => {
    if (!ordenes || !acts) return null
    const ing = ordenes.filter(o => enRango(dia(o.fecha_ingreso), per.desde, per.hasta))
    const ent = ordenes.filter(o => o.etapa === 'entregado' && enRango(dia(o.fecha_entrega), per.desde, per.hasta))
    const term = acts.filter(x => enRango(dia(x.fecha_fin), per.desde, per.hasta))
    const termPrev = prev ? acts.filter(x => enRango(dia(x.fecha_fin), prev.desde, prev.hasta)).length : null
    // serie: por día si el periodo es corto; por mes si es largo
    const ini = per.periodo === 'todo' ? (ordenes.map(o => dia(o.fecha_ingreso)!).sort()[0] ?? per.desde) : per.desde
    const finR = new Date(new Date(per.hasta + 'T12:00:00').getTime() - 86400000).toLocaleDateString('en-CA')
    const dias = Math.round((new Date(finR + 'T12:00:00').getTime() - new Date(ini + 'T12:00:00').getTime()) / 86400000) + 1
    const porMes = dias > 62
    const clave = (d: string) => porMes ? d.slice(0, 7) : d
    const llaves: string[] = []
    for (let d = ini; d <= finR; d = porMes ? mover(d.slice(0, 7) + '-01', 1) : mover(d, 0, 1)) { const k = clave(d); if (!llaves.includes(k)) llaves.push(k) }
    const serie = llaves.map(k => {
      const f = new Date((k.length === 7 ? k + '-01' : k) + 'T12:00:00')
      return {
        etiqueta: porMes ? MESES[f.getMonth()] : String(f.getDate()),
        detalle: porMes ? `${MESES[f.getMonth()]} ${f.getFullYear()}` : f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
        a: ordenes.filter(o => { const d = dia(o.fecha_ingreso); return d && clave(d) === k }).length,
        b: ordenes.filter(o => { const d = o.etapa === 'entregado' ? dia(o.fecha_entrega) : null; return d && clave(d) === k }).length,
      }
    })
    const tecnicos: Record<string, number> = {}
    for (const x of term) { const n = (x.tecnicos?.nombre ?? 'Sin técnico').trim(); tecnicos[n] = (tecnicos[n] ?? 0) + 1 }
    const aseg: Record<string, number> = {}
    for (const o of ing) { const k = o.tipo === 'particular' ? 'Particular' : (o.aseguradora_nombre ?? 'Aseguradora'); aseg[k] = (aseg[k] ?? 0) + 1 }
    const conComp = ent.filter(o => o.fecha_compromiso)
    const aTiempo = conComp.filter(o => o.entregado_a_tiempo).length
    const diasProm = ent.length ? ent.reduce((t, o) => t + (new Date(o.fecha_entrega!).getTime() - new Date(o.fecha_ingreso).getTime()) / 86400000, 0) / ent.length : null
    return {
      ingresos: ing.length, entregas: ent.length, terminados: term.length, termPrev, serie,
      tecnicos: Object.entries(tecnicos).sort((x, y) => y[1] - x[1]).slice(0, 8),
      aseg: Object.entries(aseg).sort((x, y) => y[1] - x[1]),
      aTiempo, tarde: conComp.length - aTiempo, conComp: conComp.length, diasProm,
    }
  }, [ordenes, acts, per.desde, per.hasta, per.periodo, prev?.desde, prev?.hasta]) // eslint-disable-line react-hooks/exhaustive-deps

  const ultimas = [...a.activas].sort((x, y) => y.fecha_ingreso.localeCompare(x.fecha_ingreso)).slice(0, 6)
  const hoyTxt = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hoy = hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1)
  const comp = prev ? `vs. ${per.periodo === 'anio' ? 'año anterior' : 'periodo anterior'}` : undefined

  const alertas = [
    { n: a.proximas.length, t: 'Vehículos próximos a vencer su fecha de entrega', to: '/ordenes?filtro=proximos', icon: CalendarClock, c: 'text-amber-600 bg-amber-50' },
    { n: a.retrasadas.length, t: 'Vehículos retrasados', to: '/ordenes?filtro=retrasados', icon: AlertTriangle, c: 'text-red-600 bg-red-50' },
    { n: a.detenidas.length, t: 'Vehículos detenidos por falta de materiales', to: '/ordenes?filtro=detenidos', icon: PackageX, c: 'text-orange-600 bg-orange-50' },
    { n: a.comprasPorAutorizar, t: 'Compras pendientes de autorización', to: '/compras?tab=compras&estado=por_autorizar', icon: ShoppingCart, c: 'text-[#17657c] bg-[#e3f3f7]' },
    { n: a.sinActualizar.length, t: `Vehículos sin actualización de avance (+${a.config.dias_sin_actualizacion ?? 2} días)`, to: '/ordenes?filtro=sin_actualizar', icon: Clock, c: 'text-slate-600 bg-slate-100' },
    { n: a.sinContactar, t: 'Clientes sin contactar (asignaciones)', to: '/ordenes?tab=asignaciones&estatus=sin_contactar', icon: PhoneOff, c: 'text-sky-700 bg-sky-50' },
    { n: a.listas.length, t: 'Trabajos terminados pendientes de entrega', to: '/ordenes?filtro=etapa:listo_entrega', icon: CheckCircle2, c: 'text-emerald-600 bg-emerald-50' },
  ]
  const topRent = [...rent].sort((x, y) => Number(y.utilidad_estimada) - Number(x.utilidad_estimada)).slice(0, 8)

  return (
    <div className="space-y-6">
      <PageHeader title="Panel de Control" subtitle={<>Visión integral de la operación, productividad y rentabilidad de Taller Legaria · <span className="text-white/70">{hoy}</span></>}>
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
      </PageHeader>

      {/* INDICADORES EJECUTIVOS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Car} tone="blue" value={a.activas.length} label="Vehículos en proceso" hint="al momento" to="/ordenes?filtro=activos" />
        <KpiCard icon={ClipboardList} tone="amber" value={cuenta(['recepcion', 'diagnostico', 'esperando_autorizacion'])} label="Órdenes pendientes de diagnóstico o autorización" hint="al momento" to="/ordenes?filtro=etapa:recepcion,diagnostico,esperando_autorizacion" />
        <KpiCard icon={CheckCircle2} tone="green" value={op?.terminados ?? '…'} label="Trabajos terminados en el periodo" delta={op && op.termPrev != null ? { pct: variacion(op.terminados, op.termPrev) ?? NaN, bueno: 'sube' } : null} hint={comp} to="/mano-obra?tab=productividad" />
        <KpiCard icon={Truck} tone="sky" value={a.activas.filter(o => o.fecha_compromiso && o.fecha_compromiso >= hoyISO() && o.fecha_compromiso <= sieteDias).length} label="Entregas programadas (próximos 7 días)" to="/calendario" />
        <KpiCard icon={AlertTriangle} tone="red" value={a.retrasadas.length} label="Órdenes con retraso" hint="fecha compromiso vencida" to="/ordenes?filtro=retrasados" />
        {verFin ? <>
          <KpiCard icon={Wallet} tone="cyan" value={money(fin.ingresos)} label="Ingresos del periodo (órdenes entregadas)" delta={finPrev ? { pct: variacion(fin.ingresos, finPrev.ingresos) ?? NaN, bueno: 'sube' } : null} hint={comp} to="/costos?tab=rentabilidad" />
          <KpiCard icon={Receipt} tone="orange" value={money(fin.costos)} label="Costos operativos directos" delta={finPrev ? { pct: variacion(fin.costos, finPrev.costos) ?? NaN, bueno: 'baja' } : null} hint={comp} to="/costos?tab=financiero" />
          <KpiCard icon={TrendingUp} tone={fin.utilidad >= 0 ? 'green' : 'red'} value={money(fin.utilidad)} label={`Utilidad estimada · margen ${pct(fin.margen)}`} delta={finPrev ? { pct: variacion(fin.utilidad, finPrev.utilidad) ?? NaN, bueno: 'sube' } : null} hint={comp} to="/costos?tab=rentabilidad" />
        </> : (
          <div className="card flex items-center gap-3 !p-4 text-sm text-[#66818f] sm:col-span-2 xl:col-span-3">
            <Coins className="h-6 w-6 shrink-0 text-[#93d0dd]" /> Los indicadores económicos (ingresos, costos y utilidad) solo están disponibles para los roles con acceso a finanzas.
          </div>
        )}
      </div>

      {/* ESTADO OPERATIVO (al momento) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {[
          { i: Inbox, v: asignadas, l: 'Asignados (periodo)', to: '/ordenes?tab=asignaciones' },
          { i: CalendarCheck, v: citas, l: 'Citas programadas', to: '/ordenes?tab=asignaciones&estatus=cita_programada' },
          { i: Wrench, v: cuenta(['en_reparacion']), l: 'En reparación', to: '/ordenes?filtro=etapa:en_reparacion' },
          { i: Hammer, v: cuenta(['hojalateria']), l: 'En hojalatería', to: '/ordenes?filtro=etapa:hojalateria' },
          { i: Paintbrush, v: cuenta(['preparacion', 'pintura']), l: 'En pintura', to: '/ordenes?filtro=etapa:preparacion,pintura' },
          { i: CheckCircle2, v: cuenta(['listo_entrega']), l: 'Listos para entrega', to: '/ordenes?filtro=etapa:listo_entrega' },
          { i: Sparkles, v: pendientes, l: 'Trabajos pendientes', to: '/mano-obra' },
          { i: User, v: particulares, l: 'Particulares activos', to: '/ordenes?filtro=particulares' },
        ].map(x => (
          <Link key={x.l} to={x.to} className="group flex items-center gap-2.5 rounded-2xl border border-[#dbe9ee] bg-white/80 px-3 py-2.5 transition hover:-translate-y-px hover:border-[#a7d8e2] hover:bg-white">
            <x.i className="h-[18px] w-[18px] shrink-0 text-[#2298af]" strokeWidth={1.8} />
            <div className="min-w-0 leading-tight"><div className="text-[17px] font-bold text-[#193344]">{x.v}</div><div className="truncate text-[11px] text-[#66818f]">{x.l}</div></div>
          </Link>
        ))}
      </div>

      {/* GRÁFICAS */}
      <div className="grid gap-5 xl:grid-cols-3">
        <ChartContainer className="xl:col-span-2" titulo="Órdenes recibidas y finalizadas" sub={`Ingresos al taller vs. vehículos entregados · ${per.texto}`} accion={<VerMas to="/ordenes?filtro=todos">Ver órdenes</VerMas>}
          vacio={!op ? false : op.ingresos + op.entregas === 0 && 'No hubo ingresos ni entregas en el periodo seleccionado.'}>
          {op ? <LineasDobles puntos={op.serie} /> : <div className="esqueleto h-[220px]" />}
        </ChartContainer>
        <ChartContainer titulo="Estado de los vehículos" sub="Unidades en taller por etapa" iconoVacio={Car} vacio={a.activas.length === 0 && 'No hay vehículos en el taller.'}>
          <DonaERP datos={dona} centro={a.activas.length} sub="en taller" onClick={i => nav(dona[i].to)} />
        </ChartContainer>

        <ChartContainer titulo="Productividad por técnico" sub="Trabajos terminados en el periodo" iconoVacio={HardHat} accion={<VerMas to="/mano-obra?tab=productividad" />}
          vacio={!!op && op.tecnicos.length === 0 && 'Sin trabajos terminados en el periodo.'}>
          {op ? <BarrasERP datos={op.tecnicos.map(([label, valor]) => ({ label, valor }))} /> : <div className="esqueleto h-40" />}
        </ChartContainer>
        <ChartContainer titulo="Cumplimiento de tiempos" sub="Entregas del periodo frente a su fecha compromiso" iconoVacio={Gauge}
          vacio={!!op && op.entregas === 0 && 'Sin entregas en el periodo para medir el cumplimiento.'}>
          {op && (
            <div className="flex flex-col items-center gap-4">
              <MedidorERP valor={op.conComp ? (op.aTiempo / op.conComp) * 100 : null} etiqueta="Entregadas a tiempo" />
              <div className="grid w-full grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-50 py-2"><div className="text-lg font-bold text-emerald-700">{op.aTiempo}</div><div className="text-[11px] text-emerald-700/80">A tiempo</div></div>
                <div className="rounded-xl bg-red-50 py-2"><div className="text-lg font-bold text-red-600">{op.tarde}</div><div className="text-[11px] text-red-600/80">Con retraso</div></div>
                <div className="rounded-xl bg-[#eef6f8] py-2"><div className="text-lg font-bold text-[#17657c]">{op.diasProm == null ? '—' : op.diasProm.toFixed(1)}</div><div className="text-[11px] text-[#66818f]">Días promedio</div></div>
              </div>
            </div>
          )}
        </ChartContainer>
        <ChartContainer titulo="Aseguradoras vs. particulares" sub="Vehículos ingresados en el periodo" iconoVacio={PieChart}
          vacio={!!op && op.aseg.length === 0 && 'Sin órdenes ingresadas en el periodo.'}>
          {op && <DonaERP centro={op.ingresos} sub="ingresos" datos={op.aseg.map(([label, valor], i) => ({ label, valor, color: label === 'Particular' ? P.ambar : SERIE_ERP[i % 3] }))} />}
        </ChartContainer>

        {verFin && <>
          <ChartContainer className="xl:col-span-2" titulo="Rentabilidad por orden" sub="Utilidad estimada de las órdenes entregadas en el periodo (las 8 más altas)" iconoVacio={TrendingUp} accion={<VerMas to="/costos?tab=rentabilidad" />}
            vacio={rent.length === 0 && 'Sin órdenes entregadas en el periodo.'}>
            <BarrasERP formato={money} datos={topRent.map(r => ({
              label: r.folio, valor: Number(r.utilidad_estimada), to: `/ordenes/${r.orden_id}?tab=costos`,
              color: Number(r.utilidad_estimada) >= 0 ? P.petroleo : P.rojo,
              extra: <span className="ml-1.5 font-normal text-[#66818f]">{Number(r.ingreso_reconocido) ? pct(Number(r.utilidad_estimada) / Number(r.ingreso_reconocido) * 100) : ''}</span>,
            }))} />
          </ChartContainer>
          <ChartContainer titulo="Costos de materiales" sub="Pintura, materiales y refacciones de las órdenes entregadas" iconoVacio={Paintbrush} accion={<VerMas to="/costos?tab=material" />}
            vacio={fin.materiales === 0 && 'Las órdenes entregadas en el periodo no tienen costos de materiales registrados.'}>
            <DonaERP centro={money(fin.materiales)} sub="materiales" tam={140} datos={[
              { label: 'Pintura', valor: Math.round(fin.pintura), color: P.turquesa, extra: money(fin.pintura) },
              { label: 'Materiales', valor: Math.round(fin.mat), color: P.petroleo, extra: money(fin.mat) },
              { label: 'Refacciones', valor: Math.round(fin.refacciones), color: P.ambar, extra: money(fin.refacciones) },
            ]} />
          </ChartContainer>
        </>}
      </div>

      {verFin && (
        <Card title={<>Resumen financiero <span className="text-sm font-medium text-[#66818f]">(órdenes entregadas en el periodo)</span></>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ['Ingresos registrados', fin.ingresos, ''], ['Costos de materiales', fin.materiales, 'Pintura, materiales y refacciones'],
              ['Costos de mano de obra', fin.manoObra, 'Destajos y mano de obra adicional'], ['Otros costos', fin.otros + fin.indirectos, 'Externos, otros e indirectos'],
              ['Utilidad estimada', fin.utilidad, ''], ['Margen de rentabilidad', null, ''],
            ].map(([l, v, h]) => (
              <Link key={l as string} to="/costos" className="rounded-2xl border border-[#e3eef2] bg-[#f7fbfc] p-3.5 transition hover:border-[#a7d8e2] hover:bg-white">
                <div className="text-[12px] font-medium text-[#66818f]">{l}</div>
                <div className={`mt-1 text-lg font-bold ${(l as string).startsWith('Utilidad') || (l as string).startsWith('Margen') ? (fin.utilidad >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-[#193344]'}`}>
                  {v === null ? pct(fin.margen) : money(v)}
                </div>
                {h && <div className="truncate text-[11px] text-[#8aa2ad]">{h}</div>}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-[#8aa2ad]">{rent.length} órdenes entregadas en el periodo. Incluye {fin.pctInd ?? 0}% de gastos indirectos. Cobrado en el periodo: <b className="text-[#193344]">{money(cobrado)}</b>.</p>
        </Card>
      )}

      <Card title="Alertas automáticas" action={<span className="text-xs text-[#8aa2ad]">Se actualizan cada minuto</span>}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {alertas.map(al => (
            <Link key={al.t} to={al.to} className={`flex items-center gap-3 rounded-2xl border p-3 transition hover:border-[#a7d8e2] hover:bg-[#f7fbfc] ${al.n > 0 ? 'border-[#dbe9ee]' : 'border-[#eef4f6] opacity-60'}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${al.c}`}><al.icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1 text-[13px] leading-tight text-[#193344]">{al.t}</div>
              <div className={`text-xl font-bold ${al.n > 0 ? al.c.split(' ')[0] : 'text-slate-300'}`}>{al.n}</div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Últimos vehículos en taller" action={<VerMas to="/ordenes?filtro=activos">Ver todos</VerMas>}>
          {ultimas.length === 0 ? <Empty icon={Car}>Aún no hay órdenes. Registra la primera recepción.</Empty> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th># Orden</th><th>Vehículo</th><th>Cliente / Aseguradora</th><th>Estado</th><th>Fecha ingreso</th><th></th></tr></thead>
                <tbody>{ultimas.map(o => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/ordenes/${o.id}`)}>
                    <td className="font-bold whitespace-nowrap">{o.folio}</td>
                    <td><div className="flex items-center gap-3"><Miniatura auto={o} path={o.foto_portada} /><div><div className="font-medium">{o.marca} {o.modelo}</div><div className="text-xs text-[#66818f]">{o.placas ?? '—'}</div></div></div></td>
                    <td><div className="font-medium">{o.aseguradora_nombre ?? 'Particular'}</div><div className="text-xs text-[#66818f]">{o.siniestro ?? o.cliente_nombre}</div></td>
                    <td><EtapaBadge o={o} /></td>
                    <td className="whitespace-nowrap">{fecha(o.fecha_ingreso)}</td>
                    <td><ChevronRight className="h-4 w-4 text-[#a9c1ca]" /></td>
                  </tr>))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <Card className="xl:col-span-2" title="Vehículos próximos a entregar" action={<VerMas to="/ordenes?filtro=etapa:listo_entrega">Ver todos</VerMas>}>
          {a.listas.length === 0 ? <Empty icon={CheckCircle2}>No hay vehículos listos para entrega</Empty> : (
            <ul className="divide-y divide-[#edf4f6]">
              {a.listas.slice(0, 5).map(o => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <Miniatura auto={o} path={o.foto_portada} className="h-12 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{o.folio}</div>
                    <div className="truncate text-sm text-[#66818f]">{vehiculoTxt(o)}</div>
                  </div>
                  <div className="hidden text-xs sm:block">
                    <Badge cls={ETAPAS.listo_entrega.badge}>Listo para entrega</Badge>
                    <div className="mt-1 text-[#66818f]">Compromiso {fecha(o.fecha_compromiso)}</div>
                  </div>
                  {puede('ordenes.gestionar') && <Link to={`/ordenes/${o.id}?tab=entrega`} className="btn btn-success btn-sm">Entregar</Link>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { t: 'Nuevo vehículo', s: 'Crear orden de trabajo', to: '/ordenes/nueva', icon: Car, g: 'from-[#102c43] to-[#17657c]', p: 'ordenes.gestionar', plus: true },
          { t: 'Cotización', s: 'Órdenes por presupuestar', to: '/ordenes?filtro=etapa:diagnostico', icon: FileText, g: 'from-[#17657c] to-[#2298af]', p: 'presupuestos.gestionar' },
          { t: 'Asignar trabajos', s: 'A técnicos y áreas', to: '/mano-obra?tab=trabajos', icon: Wrench, g: 'from-[#1d6f8a] to-[#3aa9c0]', p: 'actividades.asignar' },
          { t: 'Solicitar material', s: 'Pintura y refacciones', to: '/inventario?tab=solicitudes&nueva=1', icon: ShoppingCart, g: 'from-[#2b5a72] to-[#4f8fa8]', p: 'materiales.solicitar' },
          { t: 'Generar reporte', s: 'Resultados y KPIs', to: '/reportes', icon: Search, g: 'from-[#0e2638] to-[#2a4d63]', p: 'reportes.ver' },
        ].filter(q => puede(q.p)).map(q => (
          <Link key={q.t} to={q.to} className={`group relative overflow-hidden rounded-[22px] bg-gradient-to-br ${q.g} p-5 text-white shadow-[0_14px_30px_-18px_rgba(16,44,67,.9)] transition hover:-translate-y-0.5`}>
            <q.icon className="absolute -right-3 -bottom-3 h-24 w-24 opacity-10" strokeWidth={1.2} />
            <q.icon className="h-7 w-7 text-[#c5e6ed]" />
            <div className="mt-5 text-[16px] font-bold">{q.t}</div>
            <div className="text-[13px] text-white/75">{q.s}</div>
            <span className="absolute right-4 bottom-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#17657c] transition group-hover:bg-white">
              {q.plus ? <Plus className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
