import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { hoyISO } from './format'
import type { VOrden } from './tipos'

export interface Alertas {
  activas: VOrden[]
  proximas: VOrden[]; retrasadas: VOrden[]; detenidas: VOrden[]; sinActualizar: VOrden[]; listas: VOrden[]
  comprasPorAutorizar: number; sinContactar: number; solicitudesPorAutorizar: number; solicitudesPorEntregar: number
  config: Record<string, number>
  total: number
  cargado: boolean
  recargar: () => void
}
const vacio: Alertas = {
  activas: [], proximas: [], retrasadas: [], detenidas: [], sinActualizar: [], listas: [],
  comprasPorAutorizar: 0, sinContactar: 0, solicitudesPorAutorizar: 0, solicitudesPorEntregar: 0, config: {}, total: 0, cargado: false, recargar: () => {},
}
const Ctx = createContext<Alertas>(vacio)

export function AlertasProvider({ children }: { children: ReactNode }) {
  const [a, setA] = useState<Alertas>(vacio)

  const cargar = useCallback(async () => {
    const [ord, cfg, comp, asig, solA, solE] = await Promise.all([
      supabase.from('v_ordenes').select('*').not('etapa', 'in', '(entregado,cancelado)').order('fecha_compromiso', { nullsFirst: false }),
      supabase.from('configuracion').select('clave,valor'),
      supabase.from('compras').select('id', { count: 'exact', head: true }).eq('estado', 'por_autorizar'),
      supabase.from('asignaciones').select('id', { count: 'exact', head: true }).eq('estatus', 'sin_contactar'),
      supabase.from('solicitudes_material').select('id', { count: 'exact', head: true }).eq('estado', 'solicitada'),
      supabase.from('solicitudes_material').select('id', { count: 'exact', head: true }).eq('estado', 'autorizada'),
    ])
    const config = Object.fromEntries((cfg.data ?? []).map(c => [c.clave, Number(c.valor)]))
    const activas = (ord.data ?? []) as VOrden[]
    const hoy = hoyISO()
    const limite = new Date(); limite.setDate(limite.getDate() + (config.dias_alerta_entrega ?? 2))
    const limiteISO = limite.toLocaleDateString('en-CA')
    const sinAct = new Date(); sinAct.setDate(sinAct.getDate() - (config.dias_sin_actualizacion ?? 2))
    const enTaller = activas.filter(o => o.etapa !== 'listo_entrega')
    const proximas = enTaller.filter(o => o.fecha_compromiso && o.fecha_compromiso >= hoy && o.fecha_compromiso <= limiteISO)
    const retrasadas = activas.filter(o => o.retrasado)
    const detenidas = activas.filter(o => o.detenido_material)
    const sinActualizar = enTaller.filter(o => new Date(o.ultima_actualizacion) < sinAct)
    const listas = activas.filter(o => o.etapa === 'listo_entrega')
    const comprasPorAutorizar = comp.count ?? 0, sinContactar = asig.count ?? 0
    setA({
      activas, proximas, retrasadas, detenidas, sinActualizar, listas, comprasPorAutorizar, sinContactar,
      solicitudesPorAutorizar: solA.count ?? 0, solicitudesPorEntregar: solE.count ?? 0, config,
      total: proximas.length + retrasadas.length + detenidas.length + sinActualizar.length + listas.length + (comprasPorAutorizar > 0 ? 1 : 0) + (sinContactar > 0 ? 1 : 0),
      cargado: true, recargar: cargar,
    })
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [cargar])

  return <Ctx.Provider value={a}>{children}</Ctx.Provider>
}
export const useAlertas = () => useContext(Ctx)
