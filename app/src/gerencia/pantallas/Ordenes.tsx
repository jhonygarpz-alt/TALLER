import { ChevronRight, ClipboardList, Clock, FileStack, PackageX } from 'lucide-react'
import { ETAPAS, type Etapa } from '../../lib/format'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { C, Panel } from '../graficas'

const BASE = import.meta.env.BASE_URL
const expediente = (id: number) => `${BASE}ordenes/${id}`
const fecha = (iso: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) }).replace('.', '') : '—'

export function Etiqueta({ etapa }: { etapa: string }) {
  const e = ETAPAS[etapa as Etapa]
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${e?.color ?? '#64748b'}1a`, color: e?.color ?? '#475569' }}>{e?.label ?? etapa}</span>
}

export default function Ordenes({ datos: d }: PropsPantalla) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Kpi icono={FileStack} label="Asignaciones por ingresar" valor={d.dia.asignaciones_pendientes} />
        <Kpi icono={Clock} label="Compromiso de entrega hoy" valor={d.dia.compromiso_hoy} />
        <Kpi icono={ClipboardList} label="Por autorizar" valor={d.dia.por_autorizar} />
        <Kpi icono={PackageX} label="Detenidas sin material" valor={d.dia.detenidos} />
      </div>

      <Panel titulo="Requieren atención" sub="Vencidas en fecha compromiso o detenidas por material">
        {d.alertas.length === 0 ? <p className="py-3 text-center text-sm text-emerald-700">Todo en tiempo: sin unidades retrasadas.</p> : (
          <ul className="-mx-1 divide-y divide-black/[.05]">
            {d.alertas.map(a => (
              <li key={a.id}>
                <a href={expediente(a.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-3 active:bg-black/[.03]">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#fdeeed] text-[#c2453d]">
                    <span className="text-[15px] leading-none font-bold">{a.dias}</span><span className="text-[10px]">días</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><b className="text-[14px] font-semibold">{a.folio}</b><Etiqueta etapa={a.etapa} /></div>
                    <div className="truncate text-[12.5px] text-[#66818f]">{a.auto}{a.placas ? ` · ${a.placas}` : ''}</div>
                    <div className="text-[12px] text-[#c2453d]">{a.detenido ? 'Detenida por material · ' : ''}Compromiso {fecha(a.compromiso)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#8aa2ad]" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel titulo="Últimos ingresos">
        <ul className="-mx-1 divide-y divide-black/[.05]">
          {d.recientes.map(r => (
            <li key={r.id}>
              <a href={expediente(r.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-3 active:bg-black/[.03]">
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: r.tipo === 'aseguradora' ? C.verde : C.ambar }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b className="text-[14px] font-semibold">{r.folio}</b><Etiqueta etapa={r.etapa} /></div>
                  <div className="truncate text-[12.5px] text-[#66818f]">{r.auto}{r.placas ? ` · ${r.placas}` : ''} · {r.tipo === 'aseguradora' ? r.aseguradora ?? 'Aseguradora' : 'Particular'}</div>
                </div>
                <span className="shrink-0 text-[12px] text-[#66818f]">{fecha(r.fecha)}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-[11px] text-[#8aa2ad]">Toca una orden para abrir su expediente en el sistema web</p>
      </Panel>
    </>
  )
}
