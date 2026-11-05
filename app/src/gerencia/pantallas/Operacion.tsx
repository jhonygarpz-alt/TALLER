import { AlertTriangle, ChevronRight, FileStack, PackageX, RotateCcw, Wrench } from 'lucide-react'
import { AREAS, ETAPAS, type Etapa } from '../../lib/format'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Barras, C, Panel } from '../graficas'
import { nombreCorto } from '../datos'

const BASE = import.meta.env.BASE_URL
const expediente = (id: number) => `${BASE}ordenes/${id}`
const fecha = (iso: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) }) : '—'

function Etiqueta({ etapa }: { etapa: string }) {
  const e = ETAPAS[etapa as Etapa]
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${e?.color ?? '#64748b'}33`, color: '#e2e8f0' }}>{e?.label ?? etapa}</span>
}

export default function Operacion({ datos: d }: PropsPantalla) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Kpi icono={FileStack} color={C.azul} label="Asignaciones por ingresar" valor={d.dia.asignaciones_pendientes} />
        <Kpi icono={Wrench} color={C.verde} label="Trabajos terminados" valor={d.periodo.trabajos_terminados} />
        <Kpi icono={RotateCcw} color={C.rosa} label="Retrabajos" valor={d.periodo.retrabajos} />
      </div>

      <Panel titulo={<span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-400" /> Requieren atención</span>} sub="Vencidos en fecha compromiso o detenidos por material">
        {d.alertas.length === 0 ? <p className="py-3 text-center text-sm text-emerald-300">Todo en tiempo. Sin unidades retrasadas.</p> : (
          <ul className="-mx-1 divide-y divide-white/[.06]">
            {d.alertas.map(a => (
              <li key={a.id}>
                <a href={expediente(a.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-2.5 active:bg-white/5">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                    <span className="text-sm leading-none font-extrabold">{a.dias}</span><span className="text-[9px]">días</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><b className="text-sm text-white">{a.folio}</b><Etiqueta etapa={a.etapa} /></div>
                    <div className="truncate text-xs text-slate-400">{a.auto}{a.placas ? ` · ${a.placas}` : ''}</div>
                    <div className="text-[11px] text-rose-300/90">{a.detenido ? <><PackageX className="inline h-3 w-3" /> Detenido por material · </> : ''}Compromiso {fecha(a.compromiso)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel titulo="Productividad de técnicos" sub="Trabajos terminados en el periodo (en proceso entre paréntesis)">
        <Barras datos={d.tecnicos.map((t, i) => ({ label: `${nombreCorto(t.nombre)} · ${AREAS[t.area] ?? t.area}`, valor: t.terminados, color: [C.verde, C.cian, C.violeta, C.ambar, C.rosa, C.azul][i % 6], extra: <span className="font-normal text-slate-400"> ({t.en_proceso})</span> }))} vacio="Sin trabajos en el periodo" />
      </Panel>

      <Panel titulo="Marcas más atendidas" sub="Ingresos del periodo">
        <Barras datos={d.marcas.map(m => ({ label: m.marca, valor: m.n }))} vacio="Sin ingresos en el periodo" />
      </Panel>

      <Panel titulo="Últimos ingresos">
        <ul className="-mx-1 divide-y divide-white/[.06]">
          {d.recientes.map(r => (
            <li key={r.id}>
              <a href={expediente(r.id)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-2.5 active:bg-white/5">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: r.tipo === 'aseguradora' ? C.verde : C.violeta, boxShadow: `0 0 8px ${r.tipo === 'aseguradora' ? C.verde : C.violeta}` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b className="text-sm text-white">{r.folio}</b><Etiqueta etapa={r.etapa} /></div>
                  <div className="truncate text-xs text-slate-400">{r.auto}{r.placas ? ` · ${r.placas}` : ''} · {r.tipo === 'aseguradora' ? r.aseguradora ?? 'Aseguradora' : 'Particular'}</div>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">{fecha(r.fecha)}</span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
