import { AlarmClock, CalendarCheck, CarFront, CheckCircle2, ClipboardList, Clock, PackageX, Star, Timer, Warehouse } from 'lucide-react'
import { ETAPAS, ETAPAS_ACTIVAS } from '../../lib/format'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Barras, C, Dona, Medidor, Panel, Tendencia } from '../graficas'

export default function Resumen({ datos: d, periodo }: PropsPantalla) {
  const p = d.periodo, h = d.dia
  const cumplimiento = p.con_compromiso ? p.a_tiempo / p.con_compromiso * 100 : null
  const etapas = ETAPAS_ACTIVAS.filter(e => d.etapas[e]).map(e => ({ label: ETAPAS[e].label, valor: d.etapas[e], color: ETAPAS[e].color === '#16a34a' ? C.verde : undefined }))
  return (
    <>
      {/* Hoy */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-bold tracking-[.14em] text-slate-400 uppercase">Hoy en el taller</h2>
        <div className="grid grid-cols-2 gap-3">
          <Kpi grande icono={CarFront} color={C.verde} label="Ingresaron hoy" valor={h.ingresos} />
          <Kpi grande icono={CheckCircle2} color={C.cian} label="Entregados hoy" valor={h.entregas} />
          <Kpi grande icono={Warehouse} color={C.violeta} label="Unidades en taller" valor={h.en_taller} />
          <Kpi grande icono={CalendarCheck} color={C.ambar} label="Listos para entrega" valor={h.listos} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { i: AlarmClock, v: h.retrasados, l: 'Retrasados', c: C.rojo },
            { i: Clock, v: h.compromiso_hoy, l: 'Compromiso hoy', c: C.ambar },
            { i: ClipboardList, v: h.por_autorizar, l: 'Por autorizar', c: C.azul },
            { i: PackageX, v: h.detenidos, l: 'Sin material', c: C.rosa },
          ].map(x => (
            <div key={x.l} className="rounded-2xl border border-white/[.07] bg-white/[.03] px-1.5 py-2.5 text-center">
              <x.i className="mx-auto h-4 w-4" style={{ color: x.c }} />
              <div className="mt-1 text-xl font-extrabold" style={{ color: x.v ? x.c : '#e2e8f0' }}>{x.v}</div>
              <div className="text-[10px] leading-tight text-slate-400">{x.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Periodo */}
      {periodo !== 'hoy' && (
        <Panel titulo="Desempeño del periodo">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-3xl font-extrabold text-white">{p.ingresos}</div><div className="text-[11px] text-slate-400">Ingresos</div></div>
            <div><div className="text-3xl font-extrabold text-white">{p.entregas}</div><div className="text-[11px] text-slate-400">Entregas</div></div>
            <div><div className="text-3xl font-extrabold text-white">{p.trabajos_terminados}</div><div className="text-[11px] text-slate-400">Trabajos terminados</div></div>
          </div>
        </Panel>
      )}

      <Panel titulo="Ingresos vs entregas" sub={d.serie.length > 0 && d.serie[0].d < d.desde ? 'Últimos 7 días' : 'Por día del periodo'}>
        <Tendencia serie={d.serie} />
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel className="!p-3">
          <Medidor valor={cumplimiento} etiqueta="Entregas a tiempo" />
          <div className="mt-1 text-center text-[11px] text-slate-500">{p.a_tiempo} de {p.con_compromiso} con fecha compromiso</div>
        </Panel>
        <Panel className="!p-3">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Timer className="h-5 w-5 text-cyan-300" />
            <div className="mt-1 text-3xl font-extrabold text-white">{p.dias_promedio ?? '—'}</div>
            <div className="text-[11px] text-slate-400">días promedio en taller</div>
            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4" style={{ color: C.ambar, fill: p.satisfaccion != null && i <= Math.round(p.satisfaccion) ? C.ambar : 'transparent' }} />)}
            </div>
            <div className="text-[11px] text-slate-400">{p.satisfaccion != null ? `${p.satisfaccion} · ${p.encuestas} encuesta${p.encuestas === 1 ? '' : 's'}` : 'Sin encuestas'}</div>
          </div>
        </Panel>
      </div>

      <Panel titulo="Origen de los ingresos" sub="Vehículos que ingresaron en el periodo">
        <Dona centro={p.ingresos} sub="unidades" datos={[
          { label: 'Aseguradora', valor: p.ingresos_aseguradora, color: C.verde },
          { label: 'Particular', valor: p.ingresos_particular, color: C.violeta },
        ]} />
      </Panel>

      <Panel titulo="Unidades en taller por etapa" sub={`${h.en_taller} vehículos en proceso ahora`}>
        <Barras datos={etapas} vacio="No hay vehículos en proceso" />
      </Panel>
    </>
  )
}
