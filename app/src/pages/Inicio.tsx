import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CalendarCheck, CalendarClock, Car, CheckCircle2, ChevronRight, ClipboardList, Clock, Coins, FileText,
  Hammer, Inbox, PackageX, Paintbrush, PhoneOff, Plus, Search, ShoppingCart, Sparkles, Truck, User, Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useAlertas } from '../lib/alertas'
import { usePeriodo } from '../lib/periodo'
import { ETAPAS, fecha, hoyISO, money, pct, type Etapa } from '../lib/format'
import { vehiculoTxt, type Rentabilidad, type VOrden } from '../lib/tipos'
import { Badge, Card, Empty, KpiCard, TableWrap } from '../components/ui'
import { Barras, Dona, type Dato } from '../components/Graficas'
import { Miniatura } from '../components/Fotos'
import PeriodoSelect from '../components/PeriodoSelect'

const GRUPOS: { label: string; etapas: Etapa[]; color: string; filtro: string }[] = [
  { label: 'Recepción / diagnóstico', etapas: ['recepcion', 'diagnostico', 'esperando_autorizacion'], color: '#ca8a04', filtro: 'etapa:recepcion,diagnostico,esperando_autorizacion' },
  { label: 'En reparación', etapas: ['en_reparacion'], color: '#15a050', filtro: 'etapa:en_reparacion' },
  { label: 'Hojalatería', etapas: ['hojalateria'], color: '#0891b2', filtro: 'etapa:hojalateria' },
  { label: 'Preparación / pintura', etapas: ['preparacion', 'pintura'], color: '#9333ea', filtro: 'etapa:preparacion,pintura' },
  { label: 'Detallado / calidad', etapas: ['detallado', 'control_calidad'], color: '#ea580c', filtro: 'etapa:detallado,control_calidad' },
  { label: 'Listos para entrega', etapas: ['listo_entrega'], color: '#16a34a', filtro: 'etapa:listo_entrega' },
]

export function EtapaBadge({ o }: { o: Pick<VOrden, 'etapa' | 'retrasado'> }) {
  if (o.retrasado) return <Badge cls="bg-red-100 text-red-700">Retrasado · {ETAPAS[o.etapa].label}</Badge>
  return <Badge cls={ETAPAS[o.etapa].badge}>{ETAPAS[o.etapa].label}</Badge>
}

export default function Inicio() {
  const { perfil, puede } = useAuth()
  const a = useAlertas()
  const nav = useNavigate()
  const per = usePeriodo('mes')
  const [asignadas, setAsignadas] = useState(0)
  const [citas, setCitas] = useState(0)
  const [pendientes, setPendientes] = useState(0)
  const [porAseg, setPorAseg] = useState<Dato[]>([])
  const [rent, setRent] = useState<Rentabilidad[]>([])
  const [cobrado, setCobrado] = useState(0)
  const verFin = puede('finanzas.ver')

  useEffect(() => {
    const { desde, hasta } = per
    supabase.from('asignaciones').select('id', { count: 'exact', head: true }).gte('fecha_asignacion', desde).lt('fecha_asignacion', hasta)
      .then(r => setAsignadas(r.count ?? 0))
    supabase.from('asignaciones').select('id', { count: 'exact', head: true }).eq('estatus', 'cita_programada').then(r => setCitas(r.count ?? 0))
    supabase.from('actividades').select('id', { count: 'exact', head: true }).in('estado', ['asignada', 'en_proceso', 'terminada']).then(r => setPendientes(r.count ?? 0))
    supabase.from('v_ordenes').select('aseguradora_nombre').gte('fecha_ingreso', desde).lt('fecha_ingreso', hasta).neq('etapa', 'cancelado').then(({ data }) => {
      const c: Record<string, number> = {}
      for (const r of data ?? []) { const k = r.aseguradora_nombre ?? 'Particular'; c[k] = (c[k] ?? 0) + 1 }
      setPorAseg(Object.entries(c).sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value, color: '#15a050' })))
    })
    if (verFin) {
      supabase.from('v_rentabilidad').select('*').eq('etapa', 'entregado').gte('fecha_entrega', desde).lt('fecha_entrega', hasta)
        .then(({ data }) => setRent((data ?? []) as Rentabilidad[]))
      supabase.from('cobros').select('monto').gte('fecha', desde).lt('fecha', hasta)
        .then(({ data }) => setCobrado((data ?? []).reduce((s, r) => s + Number(r.monto), 0)))
    }
  }, [per.desde, per.hasta, verFin]) // eslint-disable-line react-hooks/exhaustive-deps

  const sieteDias = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
  const cuenta = (etapas: Etapa[]) => a.activas.filter(o => etapas.includes(o.etapa)).length
  const dona = GRUPOS.map(g => ({ label: g.label, value: cuenta(g.etapas), color: g.color, to: `/ordenes?filtro=${g.filtro}` }))
  const particulares = a.activas.filter(o => o.tipo === 'particular').length

  const fin = useMemo(() => {
    const s = (k: keyof Rentabilidad) => rent.reduce((t, r) => t + Number(r[k] ?? 0), 0)
    const ingresos = s('ingreso_reconocido')
    const materiales = s('costo_pintura') + s('costo_materiales') + s('costo_refacciones')
    const manoObra = s('costo_destajos') + s('costo_mano_obra_adicional')
    const otros = s('costo_servicios_externos') + s('costo_otros')
    const indirectos = s('indirectos_asignados')
    const utilidad = ingresos - materiales - manoObra - otros - indirectos
    return { ingresos, materiales, manoObra, otros, indirectos, utilidad, margen: ingresos ? (utilidad / ingresos) * 100 : NaN, pctInd: rent[0]?.indirectos_pct ?? a.config.indirectos_pct }
  }, [rent, a.config.indirectos_pct])

  const ultimas = [...a.activas].sort((x, y) => y.fecha_ingreso.localeCompare(x.fecha_ingreso)).slice(0, 6)
  const hoyTxt = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hoy = hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1)

  const alertas = [
    { n: a.proximas.length, t: 'Vehículos próximos a vencer su fecha de entrega', to: '/ordenes?filtro=proximos', icon: CalendarClock, c: 'text-amber-600 bg-amber-50' },
    { n: a.retrasadas.length, t: 'Vehículos retrasados', to: '/ordenes?filtro=retrasados', icon: AlertTriangle, c: 'text-red-600 bg-red-50' },
    { n: a.detenidas.length, t: 'Vehículos detenidos por falta de materiales', to: '/ordenes?filtro=detenidos', icon: PackageX, c: 'text-orange-600 bg-orange-50' },
    { n: a.comprasPorAutorizar, t: 'Compras pendientes de autorización', to: '/compras?tab=compras&estado=por_autorizar', icon: ShoppingCart, c: 'text-brand-700 bg-blue-50' },
    { n: a.sinActualizar.length, t: `Vehículos sin actualización de avance (+${a.config.dias_sin_actualizacion ?? 2} días)`, to: '/ordenes?filtro=sin_actualizar', icon: Clock, c: 'text-slate-600 bg-slate-100' },
    { n: a.sinContactar, t: 'Clientes sin contactar (asignaciones)', to: '/ordenes?tab=asignaciones&estatus=sin_contactar', icon: PhoneOff, c: 'text-purple-600 bg-purple-50' },
    { n: a.listas.length, t: 'Trabajos terminados pendientes de entrega', to: '/ordenes?filtro=etapa:listo_entrega', icon: CheckCircle2, c: 'text-green-600 bg-green-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Bienvenido, {perfil?.nombre.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">Resumen general del taller • {hoy}</p>
        </div>
        <PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
      </div>

      {/* INDICADORES PRINCIPALES */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <KpiCard icon={Car} tone="blue" value={a.activas.length} label="Vehículos en taller" to="/ordenes?filtro=activos" />
        <KpiCard icon={Inbox} tone="indigo" value={asignadas} label="Asignados (periodo)" to="/ordenes?tab=asignaciones" />
        <KpiCard icon={CalendarCheck} tone="sky" value={citas} label="Citas programadas" to="/ordenes?tab=asignaciones&estatus=cita_programada" />
        <KpiCard icon={ClipboardList} tone="amber" value={cuenta(['recepcion', 'diagnostico', 'esperando_autorizacion'])} label="En diagnóstico" to="/ordenes?filtro=etapa:recepcion,diagnostico,esperando_autorizacion" />
        <KpiCard icon={Wrench} tone="orange" value={cuenta(['en_reparacion'])} label="En reparación" to="/ordenes?filtro=etapa:en_reparacion" />
        <KpiCard icon={Hammer} tone="cyan" value={cuenta(['hojalateria'])} label="En hojalatería" to="/ordenes?filtro=etapa:hojalateria" />
        <KpiCard icon={Paintbrush} tone="purple" value={cuenta(['preparacion', 'pintura'])} label="En pintura" to="/ordenes?filtro=etapa:preparacion,pintura" />
        <KpiCard icon={CheckCircle2} tone="green" value={cuenta(['listo_entrega'])} label="Listos para entrega" to="/ordenes?filtro=etapa:listo_entrega" />
        <KpiCard icon={Truck} tone="sky" value={a.activas.filter(o => o.fecha_compromiso && o.fecha_compromiso >= hoyISO() && o.fecha_compromiso <= sieteDias).length} label="Entregas programadas (7 días)" to="/calendario" />
        <KpiCard icon={AlertTriangle} tone="red" value={a.retrasadas.length} label="Retrasados" to="/ordenes?filtro=retrasados" />
        <KpiCard icon={Sparkles} tone="indigo" value={pendientes} label="Trabajos pendientes" to="/mano-obra" />
        <KpiCard icon={User} tone="blue" value={particulares} label="Particulares activos" to="/ordenes?filtro=particulares" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Estado de los vehículos">
          {a.activas.length === 0 ? <Empty icon={Car}>No hay vehículos en el taller</Empty>
            : <Dona datos={dona} centro="En taller" onClick={d => d.to && nav(d.to)} />}
        </Card>
        <Card title={<>Órdenes por aseguradora <span className="text-sm font-medium text-slate-500">(ingresadas en el periodo)</span></>}>
          {porAseg.length === 0 ? <Empty icon={Car}>Sin órdenes ingresadas en el periodo</Empty> : <Barras datos={porAseg} />}
        </Card>
        <Card title={<>Resumen financiero <span className="text-sm font-medium text-slate-500">(órdenes entregadas)</span></>}>
          {!verFin ? <p className="text-sm text-slate-500">Tu rol no tiene acceso a indicadores económicos.</p> : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100"><Coins className="h-7 w-7 text-amber-500" /></div>
                <div className="flex-1 space-y-2">
                  <div><div className="text-xs text-slate-500">Ingresos autorizados</div><div className="text-2xl font-extrabold">{money(fin.ingresos)}</div></div>
                  <div><div className="text-xs text-slate-500">Costos directos</div><div className="text-xl font-bold">{money(fin.materiales + fin.manoObra + fin.otros)}</div></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div className="border-l-4 border-green-500 pl-3">
                  <div className="text-xs text-slate-500">Utilidad estimada</div>
                  <div className={`text-xl font-extrabold ${fin.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>{money(fin.utilidad)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Margen</div>
                  <div className={`text-xl font-extrabold ${fin.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pct(fin.margen)}</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">{rent.length} órdenes entregadas en el periodo. Incluye {fin.pctInd ?? 0}% de gastos indirectos. Cobrado en el periodo: <b>{money(cobrado)}</b>.</p>
            </div>
          )}
        </Card>
      </div>

      {verFin && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Ingresos registrados', fin.ingresos, ''], ['Costos de materiales', fin.materiales, 'Pintura, materiales y refacciones'],
            ['Costos de mano de obra', fin.manoObra, 'Destajos y mano de obra adicional'], ['Otros costos', fin.otros + fin.indirectos, 'Externos, otros e indirectos'],
            ['Utilidad estimada', fin.utilidad, ''], ['Margen de rentabilidad', null, ''],
          ].map(([l, v, h]) => (
            <Link key={l as string} to="/costos" className="card !p-4 hover:border-brand-300">
              <div className="text-xs font-medium text-slate-500">{l}</div>
              <div className={`mt-1 text-lg font-extrabold ${(l as string).startsWith('Utilidad') || (l as string).startsWith('Margen') ? (fin.utilidad >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                {v === null ? pct(fin.margen) : money(v)}
              </div>
              {h && <div className="truncate text-[11px] text-slate-400">{h}</div>}
            </Link>
          ))}
        </div>
      )}

      <Card title="Alertas automáticas" action={<span className="text-xs text-slate-400">Se actualizan cada minuto</span>}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {alertas.map(al => (
            <Link key={al.t} to={al.to} className={`flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm ${al.n > 0 ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${al.c}`}><al.icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1 text-sm leading-tight text-slate-700">{al.t}</div>
              <div className={`text-xl font-extrabold ${al.n > 0 ? al.c.split(' ')[0] : 'text-slate-300'}`}>{al.n}</div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Últimos vehículos en taller" className="xl:col-span-3" action={<Link to="/ordenes?filtro=activos" className="text-sm font-semibold text-brand-700 hover:underline">Ver todos</Link>}>
          {ultimas.length === 0 ? <Empty icon={Car}>Aún no hay órdenes. Registra la primera recepción.</Empty> : (
            <TableWrap>
              <table className="tbl">
                <thead><tr><th># Orden</th><th>Vehículo</th><th>Cliente / Aseguradora</th><th>Estado</th><th>Fecha ingreso</th><th></th></tr></thead>
                <tbody>{ultimas.map(o => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/ordenes/${o.id}`)}>
                    <td className="font-bold whitespace-nowrap">{o.folio}</td>
                    <td><div className="flex items-center gap-3"><Miniatura path={o.foto_portada} /><div><div className="font-medium">{o.marca} {o.modelo}</div><div className="text-xs text-slate-500">{o.placas ?? '—'}</div></div></div></td>
                    <td><div className="font-medium">{o.aseguradora_nombre ?? 'Particular'}</div><div className="text-xs text-slate-500">{o.siniestro ?? o.cliente_nombre}</div></td>
                    <td><EtapaBadge o={o} /></td>
                    <td className="whitespace-nowrap">{fecha(o.fecha_ingreso)}</td>
                    <td><ChevronRight className="h-4 w-4 text-slate-300" /></td>
                  </tr>))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <Card title="Vehículos próximos a entregar" className="xl:col-span-2" action={<Link to="/ordenes?filtro=etapa:listo_entrega" className="text-sm font-semibold text-brand-700 hover:underline">Ver todos</Link>}>
          {a.listas.length === 0 ? <Empty icon={CheckCircle2}>No hay vehículos listos para entrega</Empty> : (
            <ul className="divide-y">
              {a.listas.slice(0, 5).map(o => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <Miniatura path={o.foto_portada} className="h-12 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{o.folio}</div>
                    <div className="truncate text-sm text-slate-500">{vehiculoTxt(o)}</div>
                  </div>
                  <div className="hidden text-xs sm:block">
                    <Badge cls={ETAPAS.listo_entrega.badge}>Listo para entrega</Badge>
                    <div className="mt-1 text-slate-500">📅 {fecha(o.fecha_compromiso)}</div>
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
          { t: 'Nuevo vehículo', s: 'Crear orden de trabajo', to: '/ordenes/nueva', icon: Car, g: 'from-brand-800 to-brand-600', p: 'ordenes.gestionar', plus: true },
          { t: 'Cotización', s: 'Órdenes por presupuestar', to: '/ordenes?filtro=etapa:diagnostico', icon: FileText, g: 'from-emerald-700 to-emerald-500', p: 'presupuestos.gestionar' },
          { t: 'Asignar trabajos', s: 'A técnicos y áreas', to: '/mano-obra?tab=trabajos', icon: Wrench, g: 'from-violet-700 to-purple-500', p: 'actividades.asignar' },
          { t: 'Solicitar material', s: 'Pintura y refacciones', to: '/inventario?tab=solicitudes&nueva=1', icon: ShoppingCart, g: 'from-orange-600 to-amber-500', p: 'materiales.solicitar' },
          { t: 'Generar reporte', s: 'Resultados y KPIs', to: '/reportes', icon: Search, g: 'from-slate-700 to-slate-500', p: 'reportes.ver' },
        ].filter(q => puede(q.p)).map(q => (
          <Link key={q.t} to={q.to} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${q.g} p-5 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg`}>
            <q.icon className="absolute -right-3 -bottom-3 h-24 w-24 opacity-15" strokeWidth={1.2} />
            <q.icon className="h-8 w-8" />
            <div className="mt-6 text-lg font-bold">{q.t}</div>
            <div className="text-sm text-white/80">{q.s}</div>
            <span className="absolute right-4 bottom-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800">
              {q.plus ? <Plus className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
