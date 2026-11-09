import { useEffect, useState } from 'react'
import { AlarmClock, ArrowDownRight, ArrowUpRight, CarFront, CircleCheck, Clock, Package, PackageX, ClipboardList, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { C, Chispa, DIAS, Dona, Lineas, MESES, Panel } from '../graficas'

type Rango = 'semana' | 'mes' | 'anio'
type Punto = { d: string; ingresos: number; entregas: number }

/** Variación contra el día anterior (solo con datos reales de ayer) */
function Tendencia({ hoy, ayer }: { hoy: number; ayer: number }) {
  if (!ayer || hoy === ayer) return null
  const pct = Math.round((hoy - ayer) / ayer * 100)
  const sube = pct > 0
  const I = sube ? ArrowUpRight : ArrowDownRight
  return <span className={`flex items-center gap-0.5 text-[13px] font-semibold ${sube ? 'text-emerald-600' : 'text-[#d65a52]'}`} title="Contra ayer"><I className="h-4 w-4" />{sube ? '+' : ''}{pct}%</span>
}

/** Etapas agrupadas para la dona de órdenes */
function grupos(e: Record<string, number>) {
  const s = (...k: string[]) => k.reduce((a, x) => a + (e[x] ?? 0), 0)
  return [
    { label: 'En proceso', valor: s('en_reparacion', 'detallado', 'control_calidad'), color: C.oscuro },
    { label: 'Recepción y diagnóstico', valor: s('recepcion', 'diagnostico'), color: C.lima },
    { label: 'Hojalatería / Pintura', valor: s('hojalateria', 'preparacion', 'pintura'), color: C.ambar },
    { label: 'Pendiente autorización', valor: s('esperando_autorizacion'), color: C.gris },
    { label: 'Listo para entrega', valor: s('listo_entrega'), color: C.teal },
  ].filter(g => g.valor > 0)
}

function Rendimiento() {
  const [rango, setRango] = useState<Rango>('semana')
  const [serie, setSerie] = useState<Punto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    setSerie(null)
    supabase.rpc('gerencia_serie', { p_rango: rango }).then(({ data, error }) => { if (!vivo) return; if (error) setError(error.message); else setSerie(data as Punto[]) })
    return () => { vivo = false }
  }, [rango])
  const fecha = (iso: string) => new Date(iso + 'T12:00:00Z')
  const etiqueta = (iso: string) => rango === 'semana' ? DIAS[fecha(iso).getUTCDay()] : rango === 'mes' ? String(fecha(iso).getUTCDate()) : MESES[fecha(iso).getUTCMonth()]
  const detalle = (iso: string) => rango === 'anio' ? `${MESES[fecha(iso).getUTCMonth()]} ${fecha(iso).getUTCFullYear()}` : `${DIAS[fecha(iso).getUTCDay()]} ${fecha(iso).getUTCDate()} ${MESES[fecha(iso).getUTCMonth()]}`
  return (
    <Panel titulo="Rendimiento" sub="Ingresos vs Entregas"
      derecha={
        <div className="flex shrink-0 rounded-full bg-[#eef6f8] p-0.5 text-[12px]">
          {([['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']] as [Rango, string][]).map(([id, l]) => (
            <button key={id} onClick={() => setRango(id)} className={`rounded-full px-2.5 py-1.5 transition ${rango === id ? 'bg-gradient-to-b from-[#2298af] to-[#17657c] font-semibold text-white shadow' : 'text-[#193344]'}`}>{l}</button>
          ))}
        </div>
      }>
      {error ? <p className="text-sm text-red-600">{error}</p> : !serie ? <div className="h-[210px] animate-pulse rounded-2xl bg-[#eef6f8]" />
        : <Lineas serie={serie} etiqueta={etiqueta} detalle={detalle} />}
      <p className="mt-1 text-center text-[11px] text-[#66818f]">{rango === 'semana' ? 'Últimos 7 días' : rango === 'mes' ? 'Últimos 30 días' : 'Últimos 12 meses'}</p>
    </Panel>
  )
}

export default function Resumen({ datos: d, periodo }: PropsPantalla) {
  const h = d.dia, p = d.periodo
  const hoy = periodo === 'hoy'
  const ultimos = d.serie.slice(-7)
  const ayer = d.serie.length >= 2 ? d.serie[d.serie.length - 2] : null
  const g = grupos(d.etapas)
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Kpi icono={CarFront} label={hoy ? 'Ingresos hoy' : 'Ingresos'} valor={hoy ? h.ingresos : p.ingresos}
          derecha={hoy && ayer ? <Tendencia hoy={h.ingresos} ayer={ayer.ingresos} /> : undefined}
          abajo={<Chispa valores={ultimos.map(s => s.ingresos)} />} />
        <Kpi icono={CircleCheck} label={hoy ? 'Entregas hoy' : 'Entregas'} valor={hoy ? h.entregas : p.entregas}
          derecha={hoy && ayer ? <Tendencia hoy={h.entregas} ayer={ayer.entregas} /> : undefined}
          abajo={<Chispa valores={ultimos.map(s => s.entregas)} color={C.lima} />} />
        <Kpi icono={Wrench} label="Unidades en taller" valor={h.en_taller} />
        <Kpi icono={Package} label="Listas para entrega" valor={h.listos} />
      </div>

      <Panel titulo="Órdenes de Trabajo" sub="Estado actual de las unidades" a="/taller">
        {h.en_taller ? <Dona centro={h.en_taller} sub="Unidades" datos={g} /> : <p className="py-4 text-center text-sm text-[#66818f]">No hay unidades en proceso</p>}
      </Panel>

      <Rendimiento />

      <Panel titulo="Puntos de atención" sub="Al momento" a="/ordenes">
        <div className="grid grid-cols-4 gap-2">
          {[
            { i: AlarmClock, v: h.retrasados, l: 'Retrasadas', c: C.rojo },
            { i: Clock, v: h.compromiso_hoy, l: 'Entregan hoy', c: C.ambar },
            { i: ClipboardList, v: h.por_autorizar, l: 'Por autorizar', c: C.azul },
            { i: PackageX, v: h.detenidos, l: 'Sin material', c: C.teal },
          ].map(x => (
            <div key={x.l} className="rounded-2xl bg-[#f4f9fb] px-1 py-3 text-center">
              <x.i className="mx-auto h-[18px] w-[18px]" strokeWidth={1.8} style={{ color: x.c }} />
              <div className="mt-1 text-[22px] leading-none font-bold" style={{ color: x.v ? x.c : C.texto }}>{x.v}</div>
              <div className="mt-1 text-[11px] leading-tight text-[#66818f]">{x.l}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
