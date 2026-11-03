import { useEffect, useState, type ReactNode } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEmpresa } from '../../lib/empresa'
import { errorTexto } from '../../lib/format'
import { ErrorMsg } from '../../components/ui'

/**
 * Reporte mensual "Análisis de Rendimiento Operativo y Costos" con la misma estructura del PDF
 * que se emite cada mes (MAPFRE / particulares / Toyota, facturación, rendimiento y gráficas).
 * Los datos salen de la función reporte_mensual() (órdenes ENTREGADAS en el mes).
 */

interface Grupo {
  ordenes: number; ingreso: number; pago_refacciones: number; mo_carroceria: number; mo_mecanica: number; mo_pintura: number
  materiales_autorizados: number; hojalatero: number; pintor: number; pulido: number; materiales: number; refacciones: number
  adicionales: number; costo: number; util_prom: number | null; util_ref_prom: number | null
}
interface Datos {
  grupos: Record<string, Grupo>; destajo_pct: number; facturado_total: number; facturado_mapfre: number
  dias_entrega: number | null; dias_taller: number | null; asignados_anteriores: number; asignados_corriente: number; entregados_total: number
  asignaciones: { total: number; abierto: number; cancelado: number; cerrado: number }
  entregados_3m: { mes: string; n: number }[]; global: { mes: string; n: number }[]
}
const CERO: Grupo = { ordenes: 0, ingreso: 0, pago_refacciones: 0, mo_carroceria: 0, mo_mecanica: 0, mo_pintura: 0, materiales_autorizados: 0, hojalatero: 0, pintor: 0, pulido: 0, materiales: 0, refacciones: 0, adicionales: 0, costo: 0, util_prom: null, util_ref_prom: null }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const n2 = (v: number) => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const pct = (v: number | null | undefined) => (v == null || !isFinite(v) ? '' : `${Math.round(v * 100)}%`)
const div = (a: number, b: number) => (b ? a / b : null)

/* ---------- Piezas del formato ---------- */
function Encabezado({ children, color, texto = '#000' }: { children: ReactNode; color: string; texto?: string }) {
  return <div className="border border-black text-center text-[10px] font-bold leading-[15px]" style={{ background: color, color: texto }}>{children}</div>
}
/** Renglón "CONCEPTO   $   1,234.56" (cero se muestra como "-", igual que en Excel) */
function Fila({ l, v, link, gris, negrita, rojo, sub }: { l: string; v?: number | null; link?: boolean; gris?: boolean; negrita?: boolean; rojo?: boolean; sub?: string }) {
  const color = gris ? '#8c8c8c' : link ? '#31849b' : rojo ? '#e00000' : undefined
  return (
    <div className={`grid grid-cols-[1fr_14px_86px] text-[10px] leading-[13px] ${negrita ? 'font-bold' : ''}`} style={{ color }}>
      <span className={link ? 'underline' : ''}>{l}</span>
      {sub != null ? <><span /><span className={`text-right ${link ? 'underline' : ''}`}>{sub}</span></>
        : <><span className={link && negrita ? 'underline' : ''}>$</span><span className={`text-right ${link && negrita ? 'underline' : ''}`}>{v ? n2(v) : '-'}</span></>}
    </div>
  )
}
/** Barras verticales con valor encima (SVG) */
function Barras({ datos, alto = 130, max: maxIn, paso = 10, color, borde, etiqueta }: {
  datos: { label: ReactNode; v: number; color?: string }[]; alto?: number; max?: number; paso?: number; color: string; borde?: string; etiqueta?: boolean
}) {
  const max = Math.max(maxIn ?? 0, ...datos.map(d => d.v), 1)
  const tope = Math.ceil(max / paso) * paso || paso
  const ticks = Array.from({ length: tope / paso + 1 }, (_, i) => i * paso)
  const W = 100 / datos.length
  return (
    <div className="flex gap-1">
      <div className="relative w-5 text-right text-[8px] text-slate-600" style={{ height: alto }}>
        {ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / tope) * 100}%` }}>{t}</span>)}
      </div>
      <div className="flex-1">
        <div className="relative" style={{ height: alto }}>
          {ticks.map(t => <div key={t} className="absolute inset-x-0 border-t border-dotted border-slate-300" style={{ top: `${100 - (t / tope) * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end">
            {datos.map((d, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end" style={{ width: `${W}%` }}>
                {etiqueta && <span className="mb-0.5 text-[8px] text-slate-700">{d.v}</span>}
                <div style={{ height: `${(d.v / tope) * 100}%`, background: d.color ?? color, border: borde ? `1px solid ${borde}` : undefined, width: '46%', minHeight: d.v ? 1 : 0 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex border-t border-slate-400">{datos.map((d, i) => <div key={i} className="text-center text-[8px] leading-tight font-bold text-slate-700" style={{ width: `${W}%` }}>{d.label}</div>)}</div>
      </div>
    </div>
  )
}

export default function ReporteMensual() {
  const emp = useEmpresa()
  const hoy = new Date()
  const previo = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const [periodo, setPeriodo] = useState(`${previo.getFullYear()}-${String(previo.getMonth() + 1).padStart(2, '0')}`)
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [notas, setNotas] = useState('')
  const [anio, mes] = periodo.split('-').map(Number)

  async function cargar() {
    setCargando(true); setError(null)
    const { data, error } = await supabase.rpc('reporte_mensual', { p_anio: anio, p_mes: mes })
    setCargando(false)
    if (error) return setError(errorTexto(error))
    setD(data as Datos)
  }
  useEffect(() => { cargar() }, [periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = d?.grupos.mapfre ?? CERO, p = d?.grupos.particular ?? CERO, t = d?.grupos.toyota ?? CERO
  const moCM = m.mo_carroceria + m.mo_mecanica
  const totalMO = moCM + m.mo_pintura
  const utilRef = m.pago_refacciones - m.refacciones
  const dif = m.ingreso - (d?.facturado_mapfre ?? 0)
  const tasa = (d?.destajo_pct ?? 20) / 100
  const mesTxt = MESES[mes - 1]?.toUpperCase() ?? ''
  const sigTxt = MESES[mes % 12].toUpperCase()

  useEffect(() => { setNotas(dif > 0.005 ? `SE APLICARÁ EN ${sigTxt}` : '') }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  function imprimir() {
    document.body.classList.add('imprimir-reporte')
    const quitar = () => { document.body.classList.remove('imprimir-reporte'); window.removeEventListener('afterprint', quitar) }
    window.addEventListener('afterprint', quitar)
    window.print()
  }

  const gasto = (g: Grupo, etiquetas: string[], conAdicionales = false) => {
    const util = g.ingreso - g.costo
    return <>
      <Fila l={etiquetas[0]} v={g.ingreso} />
      <Fila l={etiquetas[1]} v={g.hojalatero} />
      <Fila l={etiquetas[2]} v={g.pintor} />
      <Fila l={etiquetas[3]} v={g.pulido} />
      <Fila l="MATERIALES" v={conAdicionales ? g.materiales : g.materiales + g.adicionales} />
      <Fila l="REFACCIONES" v={g.refacciones} />
      {conAdicionales && <Fila l="GASTOS ADICIONALES" v={g.adicionales} />}
      <Fila l="TOTAL SIN IVA" v={g.costo} />
      <Fila l="UTILIDAD" v={g.ingreso || g.costo ? util : 0} link negrita />
      <Fila l="% PROMEDIO DE UTILIDAD TOTAL" sub={pct(g.util_prom)} link />
      <Fila l="% DE UTILIDAD TOTAL" sub={pct(div(util, g.ingreso))} link />
    </>
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label className="block"><span className="label">Mes del reporte</span>
          <input type="month" className="input w-auto" value={periodo} onChange={e => e.target.value && setPeriodo(e.target.value)} /></label>
        <button className="btn btn-secondary" onClick={cargar} disabled={cargando}><RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar</button>
        <button className="btn btn-primary" onClick={imprimir} disabled={!d}><Printer className="h-4 w-4" /> Imprimir / Guardar PDF</button>
        <p className="w-full text-xs text-slate-500 lg:w-auto lg:flex-1">Cifras de las órdenes <b>entregadas</b> en el mes, calculadas con presupuestos autorizados, destajos, salidas de almacén, otros costos y facturas registradas. Las observaciones se pueden escribir antes de imprimir (no se guardan).</p>
      </div>
      <ErrorMsg error={error} />

      <div className="overflow-x-auto pb-4">
        <div className="reporte-hoja mx-auto w-[816px] bg-white p-[22px] font-[Arial,Helvetica,sans-serif] text-black shadow-lg ring-1 ring-slate-200">
          {/* Encabezado */}
          <div className="flex items-start gap-6">
            <div className="flex w-[130px] justify-center">{emp.logoUrl ? <img src={emp.logoUrl} alt="" className="h-[80px] w-auto object-contain" /> : null}</div>
            <div className="mt-2 flex-1 border border-slate-500 px-3 py-1.5 text-center leading-tight">
              <div className="text-[14px]">Análisis de Rendimiento Operativo y Costos COVA Automotriz.</div>
              <div className="text-[14px] font-bold">LEGARIA</div>
            </div>
            <div className="w-[90px]" />
          </div>
          <div className="mt-3 flex justify-end"><div className="w-[218px] border border-[#8b1a1a] text-center text-[10px] font-bold leading-[17px]">{mesTxt} {anio}</div></div>

          {/* Fila 1: montos autorizados + autos asignados + análisis mensual */}
          <div className="mt-1 grid grid-cols-[350px_172px_1fr] gap-2">
            <div>
              <Encabezado color="#e6a5a5">MONTOS ECONOMICOS AUTORIZADOS MAPFRE</Encabezado>
              <Fila l="PAGO A TALLER" v={m.pago_refacciones} />
              <Fila l="PAGO DE REFACCIONES" v={m.pago_refacciones} />
              <Fila l="COSTO DE REFACCIONES LEGARIA" v={m.refacciones} />
              <Fila l="UTILIDAD EN REFACCIONES LEGARIA" v={m.pago_refacciones || m.refacciones ? utilRef : 0} link />
              <Fila l="% PROMEDIO EN UTILIDAD REFACCIONES" sub={pct(m.util_ref_prom)} link />
              <Fila l="% EN UTILIDAD REFACCIONES" sub={pct(div(utilRef, m.pago_refacciones))} link />
              <Fila l="MONTO M.O. CARROCERIA" v={m.mo_carroceria} />
              <Fila l="MONTO M.O. MECANICA" v={m.mo_mecanica} />
              <Fila l="MONTO M.O. CARROCERIA/ MECANICA" v={moCM} />
              <Fila l="MONTO M.O. PINTURA" v={m.mo_pintura} />
              <Fila l="MATERIALES" v={m.materiales_autorizados} />
              <Fila l="TOTAL M.O." v={totalMO} />
              <Fila l="MONTO AUTORIZADO MAPFRE" v={m.ingreso} />
              <Fila l="PARTICULARES Y ADICIONALES" v={p.ingreso} />
              <Fila l="TOTAL GENERAL" v={m.ingreso + p.ingreso} />
            </div>
            <div className="flex flex-col items-center border border-dotted border-[#c00000] px-2 py-2">
              <div className="text-center text-[11px] leading-tight font-bold text-slate-600">AUTOS ASIGNADOS<br />POR COMPAÑÍA</div>
              <div className="mt-6 rounded-[50%] bg-gradient-to-b from-[#e3262f] to-[#a30f17] px-4 py-2 text-[22px] font-black tracking-wider text-white italic shadow-[0_6px_0_#7a0b10]">MAPFRE</div>
              <div className="mt-3 text-[13px] font-bold text-[#1f497d]">{d?.asignaciones.total ?? 0}</div>
              <div className="mt-auto flex items-center gap-1 text-[11px] font-bold text-[#1f497d]"><span className="h-2 w-2 bg-[#c00000]" />MAPFRE</div>
            </div>
            <div className="border border-dotted border-[#4bacc6] px-2 py-1">
              <div className="text-center text-[7.5px] font-bold text-slate-600">ANALISIS MENSUAL DE AUTOS ASIGNADOS</div>
              <Barras alto={110} paso={5} color="#4f81bd" datos={[
                { label: '', v: d?.asignaciones.abierto ?? 0, color: '#4f81bd' },
                { label: 'MAPFRE', v: d?.asignaciones.cancelado ?? 0, color: '#c0504d' },
                { label: '', v: d?.asignaciones.cerrado ?? 0, color: '#9bbb59' },
              ]} />
              <table className="mt-0.5 w-full border-collapse text-[7.5px] font-bold">
                <tbody>{[['ABIERTO', '#4f81bd', d?.asignaciones.abierto], ['CANCELADO', '#c0504d', d?.asignaciones.cancelado], ['CERRADO', '#9bbb59', d?.asignaciones.cerrado]].map(([l, c, v]) => (
                  <tr key={l as string} className="border border-slate-300"><td className="px-1 text-[#1f497d]"><span className="mr-1 inline-block h-1.5 w-1.5" style={{ background: c as string }} />{l}</td><td className="text-center">{v ?? 0}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Fila 2: gastos MAPFRE / particulares */}
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            <div><Encabezado color="#e6a5a5">GASTO DE MATERIALES Y MANO DE OBRA MAPFRE</Encabezado>{gasto(m, ['PAGO MAPFRE', 'PAGO HOJALATERO', 'PAGO DE PINTOR', 'MATERIAL PARA PULIDO'])}</div>
            <div><Encabezado color="#fac090">GASTO DE MATERIALES Y MANO DE OBRA PARTICULARES</Encabezado>{gasto(p, ['PAGO PARTICULAR', 'PAGO HOJALATERO', 'PAGO DE PINTOR', 'PAGO DE PULIDO'])}</div>
          </div>

          {/* Fila 3: destajo teórico + observaciones / Toyota */}
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            <div>
              <Encabezado color="#a6a6a6">PAGOS POR DESTAJO TEORICO</Encabezado>
              <Fila l="M.O. HOJALATERIA" v={moCM} gris />
              <Fila l="TOTAL A PAGAR" v={moCM * tasa} gris />
              <Fila l="M.O. PINTURA" v={m.mo_pintura} gris />
              <Fila l="TOTAL A PAGAR" v={m.mo_pintura * tasa} gris />
              <div className="mt-1.5"><Encabezado color="#c00000" texto="#fff">OBSERVACIONES</Encabezado></div>
              {dif > 0.005 && <Fila l={`PENDIENTE DE FACTURACION ${mesTxt}`} v={dif} />}
              <textarea value={notas} onChange={e => setNotas(e.target.value.toUpperCase())} rows={2} placeholder="Escribe observaciones…"
                className="block w-full resize-none border-0 bg-transparent p-0 text-[10px] leading-[13px] uppercase outline-none placeholder:text-slate-300 placeholder:normal-case focus:bg-amber-50" />
            </div>
            <div><Encabezado color="#f79646">GASTO DE MATERIALES Y MANO DE OBRA TOYOTA</Encabezado>{gasto(t, ['PAGO TOYOTA', 'PAGO HOJALATERO', 'PAGO DE PINTOR', 'PAGO DE PULIDO'], true)}</div>
          </div>

          {/* Fila 4: autos entregados / facturación y rendimiento */}
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            <div className="border border-[#4bacc6] px-2 py-1.5">
              <div className="mb-1 text-center text-[9px] font-bold text-slate-600">AUTOS ENTREGADOS</div>
              <Barras alto={120} paso={10} color="#99ccff" borde="#3a7bd5" etiqueta datos={(d?.entregados_3m ?? []).map(x => {
                const f = new Date(x.mes + 'T12:00:00')
                return { v: x.n, label: <><div className="border-r border-slate-300 py-0.5">{f.getFullYear()}</div><div className="border-r border-slate-300 py-0.5">{MESES[f.getMonth()]}</div></> }
              })} />
            </div>
            <div>
              <Encabezado color="#00b0f0">FACTURACION</Encabezado>
              <Fila l="IMPORTE DE FACTURACION MES CORRIENTE" v={d?.facturado_mapfre ?? 0} />
              <Fila l="DIFERENCIA FACTURA VS MONTO AUTORIZADO MAPFRE" v={dif} rojo />
              <div className="h-5" />
              <div className="bg-[#ffc000] underline"><Fila l="TOTAL FACTURADO EN EL MES" v={d?.facturado_total ?? 0} /></div>
              <div className="h-5" />
              <Encabezado color="#00b050">RENDIMIENTO OPERATIVO</Encabezado>
              <div className="grid grid-cols-[1fr_70px] text-[10px] leading-[13px]">
                <span>DIAS PROMEDIO DE ENTREGA</span><span className="bg-[#e00000] pr-1 text-right font-bold">{d?.dias_entrega != null ? Math.round(d.dias_entrega) : '-'}</span>
                <span>DIAS PROMEDIO EN TALLER</span><span className="bg-[#00e000] pr-1 text-right font-bold">{d?.dias_taller != null ? Math.round(d.dias_taller) : '-'}</span>
              </div>
              <div className="h-3" />
              <div className="grid grid-cols-[1fr_70px] text-[10px] leading-[13px]">
                <span className="bg-[#fde9d9]">AUTOS ASIGNADOS MESES ANTERIORES</span><span className="bg-[#fde9d9] pr-1 text-right">{d?.asignados_anteriores ?? 0}</span>
                <span className="bg-[#fde9d9]">AUTOS ASIGNADOS MES CORRIENTE</span><span className="bg-[#fde9d9] pr-1 text-right">{d?.asignados_corriente ?? 0}</span>
                <span className="bg-[#ffc000]">TOTAL DE AUTOS FACTURADOS/ENTREGADOS</span><span className="bg-[#ffc000] pr-1 text-right">{d?.entregados_total ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Análisis global */}
          <div className="mt-3 border border-[#ffc000] px-2 py-1.5">
            <div className="mb-1 text-center text-[12px] font-bold text-slate-600">ANALISIS GLOBAL</div>
            <Barras alto={115} paso={10} color="#ffc000" borde="#bf9000" etiqueta datos={(d?.global ?? []).map(x => ({ v: x.n, label: MESES[new Date(x.mes + 'T12:00:00').getMonth()] }))} />
            <div className="mt-0.5 text-center text-[8px] font-bold text-slate-600">CERRADO</div>
          </div>
        </div>
      </div>
    </div>
  )
}
