import { CircleCheck, RotateCcw, Warehouse } from 'lucide-react'
import { AREAS, ETAPAS, ETAPAS_ACTIVAS } from '../../lib/format'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Barras, C, Panel } from '../graficas'
import { nombreCorto } from '../datos'

const COLOR_ETAPA: Record<string, string> = {
  recepcion: C.lima, diagnostico: C.lima, esperando_autorizacion: C.gris, en_reparacion: C.oscuro, hojalateria: C.ambar,
  preparacion: C.ambar, pintura: C.ambar, detallado: C.oscuro, control_calidad: C.medio, listo_entrega: C.teal,
}

export default function Taller({ datos: d }: PropsPantalla) {
  const etapas = ETAPAS_ACTIVAS.filter(e => d.etapas[e]).map(e => ({ label: ETAPAS[e].label, valor: d.etapas[e], color: COLOR_ETAPA[e] }))
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Kpi icono={Warehouse} label="Unidades en taller" valor={d.dia.en_taller} />
        <Kpi icono={CircleCheck} label="Trabajos terminados" valor={d.periodo.trabajos_terminados} />
      </div>
      <Panel titulo="Unidades por etapa" sub={`${d.dia.en_taller} vehículos en proceso ahora`}>
        <Barras datos={etapas} vacio="No hay vehículos en proceso" />
      </Panel>
      <Panel titulo="Productividad de técnicos" sub="Trabajos terminados en el periodo · (en proceso)">
        <Barras datos={d.tecnicos.map((t, i) => ({ label: `${nombreCorto(t.nombre)} · ${AREAS[t.area] ?? t.area}`, valor: t.terminados, color: [C.oscuro, C.medio, C.lima, C.ambar, C.teal, C.gris][i % 6], extra: <span className="font-normal text-[#66736c]"> ({t.en_proceso})</span> }))} vacio="Sin trabajos en el periodo" />
      </Panel>
      <Kpi icono={RotateCcw} label="Retrabajos solicitados en el periodo" valor={d.periodo.retrabajos} />
    </>
  )
}
