import { ChevronRight, ClipboardList, Clock, FileStack, PackageX } from 'lucide-react'
import { ETAPAS, type Etapa } from '../../lib/format'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Panel } from '../graficas'
import { diaDe } from '../datos'
import { Miniatura } from '../../components/Fotos'
import Recientes, { EtiquetaEtapa, useFotosOrdenes } from '../Recientes'

const BASE = import.meta.env.BASE_URL
const expediente = (id: number) => `${BASE}ordenes/${id}`
const fecha = (iso: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) }).replace('.', '') : '—'

export function Etiqueta({ etapa }: { etapa: string }) {
  const e = ETAPAS[etapa as Etapa]
  return <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: `${e?.color ?? '#64748b'}1a`, color: e?.color ?? '#475569' }}>{e?.label ?? etapa}</span>
}

export default function Ordenes({ datos: d, periodo }: PropsPantalla) {
  const dia = periodo === 'hoy' ? undefined : diaDe(periodo) ?? undefined
  const fotos = useFotosOrdenes(d.alertas.map(a => a.id))
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Kpi icono={FileStack} label="Asignaciones por ingresar" valor={d.dia.asignaciones_pendientes} />
        <Kpi icono={Clock} label="Compromiso de entrega hoy" valor={d.dia.compromiso_hoy} />
        <Kpi icono={ClipboardList} label="Por autorizar" valor={d.dia.por_autorizar} />
        <Kpi icono={PackageX} label="Detenidas sin material" valor={d.dia.detenidos} />
      </div>

      <Panel titulo="Requieren atención" sub="Vencidas en fecha compromiso o detenidas por material">
        {d.alertas.length === 0 ? <p className="py-3 text-center text-[15px] text-emerald-700">Todo en tiempo: sin unidades retrasadas.</p> : (
          <ul className="-mx-1 divide-y divide-black/[.05]">
            {d.alertas.map(a => (
              <li key={a.id}>
                <a href={expediente(a.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-3 active:bg-black/[.03]">
                  <div className="relative shrink-0">
                    <Miniatura path={fotos[a.id]} auto={{ modelo: a.auto }} className="h-[72px] w-[96px] !rounded-2xl" />
                    <span className="absolute -top-1.5 -left-1.5 rounded-full bg-[#c2453d] px-2 py-0.5 text-[12px] font-bold text-white shadow">{a.dias} días</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="text-[17px] text-[#193344]">{a.folio}</b><EtiquetaEtapa etapa={a.etapa} /></div>
                    <div className="truncate text-[15px] font-medium text-[#193344]">{a.auto}</div>
                    <div className="truncate text-[14px] text-[#4f6672]">{a.placas ?? 'Sin placas'}</div>
                    <div className="text-[14.5px] font-semibold text-[#c2453d]">{a.detenido ? 'Detenida por material · ' : ''}Compromiso {fecha(a.compromiso)}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#6f8792]" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Recientes actualizado={d.actualizado} cuantos={dia ? 40 : 12} dia={dia} />
      <p className="text-center text-[14px] text-[#4f6672]">Toca una orden para abrir su expediente en el sistema web</p>
    </>
  )
}
