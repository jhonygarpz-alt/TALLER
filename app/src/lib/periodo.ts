import { useSearchParams } from 'react-router-dom'

export type PeriodoId = 'mes' | 'mes_anterior' | '30d' | 'anio' | 'todo'
export const PERIODOS: Record<PeriodoId, string> = {
  mes: 'Este mes', mes_anterior: 'Mes anterior', '30d': 'Últimos 30 días', anio: 'Este año', todo: 'Todo el historial',
}

export function rangoPeriodo(p: PeriodoId): { desde: string; hasta: string; texto: string } {
  const hoy = new Date()
  const fmt = (d: Date) => d.toLocaleDateString('en-CA')
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1)
  let desde: Date, hasta = manana
  switch (p) {
    case 'mes': desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); break
    case 'mes_anterior': desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1); break
    case '30d': desde = new Date(hoy); desde.setDate(hoy.getDate() - 30); break
    case 'anio': desde = new Date(hoy.getFullYear(), 0, 1); break
    default: desde = new Date(2000, 0, 1)
  }
  const fin = new Date(hasta); fin.setDate(fin.getDate() - 1)
  const corto = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  return { desde: fmt(desde), hasta: fmt(hasta), texto: p === 'todo' ? 'Todo el historial' : `${corto(desde)} – ${corto(fin)}` }
}

export function usePeriodo(def: PeriodoId = 'mes') {
  const [sp, setSp] = useSearchParams()
  const p = (sp.get('periodo') as PeriodoId) || def
  const set = (v: PeriodoId) => { const n = new URLSearchParams(sp); n.set('periodo', v); setSp(n, { replace: true }) }
  return { periodo: p, setPeriodo: set, ...rangoPeriodo(p) }
}
