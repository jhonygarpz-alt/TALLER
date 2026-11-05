import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errorTexto } from '../lib/format'

export const TZ = 'America/Mexico_City'
/** Fecha de hoy (YYYY-MM-DD) en la hora del taller */
export const hoyTaller = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const sumar = (iso: string, dias: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10) }

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anterior'
export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoy', label: 'Hoy' }, { id: 'semana', label: '7 días' }, { id: 'mes', label: 'Este mes' }, { id: 'anterior', label: 'Mes anterior' },
]
export function rango(p: Periodo): { desde: string; hasta: string } {
  const h = hoyTaller()
  if (p === 'hoy') return { desde: h, hasta: h }
  if (p === 'semana') return { desde: sumar(h, -6), hasta: h }
  const ini = h.slice(0, 8) + '01'
  if (p === 'mes') return { desde: ini, hasta: h }
  const finAnt = sumar(ini, -1)
  return { desde: finAnt.slice(0, 8) + '01', hasta: finAnt }
}

export interface Tablero {
  hoy: string; desde: string; hasta: string; actualizado: string
  dia: { ingresos: number; entregas: number; en_taller: number; listos: number; retrasados: number; detenidos: number; por_autorizar: number; asignaciones_pendientes: number; compromiso_hoy: number }
  periodo: { ingresos: number; ingresos_aseguradora: number; ingresos_particular: number; entregas: number; a_tiempo: number; con_compromiso: number; dias_promedio: number | null; satisfaccion: number | null; encuestas: number; trabajos_terminados: number; retrabajos: number }
  serie: { d: string; ingresos: number; entregas: number }[]
  etapas: Record<string, number>
  marcas: { marca: string; n: number }[]
  tecnicos: { nombre: string; area: string; terminados: number; en_proceso: number }[]
  alertas: { id: number; folio: string; auto: string; placas: string | null; etapa: string; dias: number; compromiso: string | null; detenido: boolean; tipo: string }[]
  recientes: { id: number; folio: string; auto: string; placas: string | null; tipo: string; aseguradora: string | null; fecha: string; etapa: string }[]
  finanzas: null | { ingreso: number; costos: number; utilidad_bruta: number; utilidad: number; materiales: number; mano_obra: number; externos: number; ordenes: number; facturado: number; cobrado: number; por_cobrar: number; vencido: number; destajos_pendientes: number }
}

/** Indicadores del periodo; se actualizan solos cada minuto y al volver a la app */
export function useTablero(p: Periodo) {
  const [datos, setDatos] = useState<Tablero | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const cargar = useCallback(async () => {
    setCargando(true)
    const r = rango(p)
    const { data, error } = await supabase.rpc('gerencia_tablero', { p_desde: r.desde, p_hasta: r.hasta })
    setCargando(false)
    if (error) return setError(errorTexto(error))
    setError(null); setDatos(data as Tablero)
  }, [p])
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    const vis = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [cargar])
  return { datos, error, cargando, recargar: cargar }
}

export const nombreCorto = (n: string) => n.trim().split(/\s+/).slice(0, 2).join(' ')
export const moneda = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const monedaCorta = (n: number) => Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)} M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)} k` : `$${Math.round(n)}`
