import { useEffect, useState } from 'react'
import { ChevronRight, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ETAPAS, type Etapa } from '../lib/format'
import { Miniatura } from '../components/Fotos'
import { Panel } from './graficas'

const BASE = import.meta.env.BASE_URL

interface Ingreso {
  id: number; folio: string; marca: string; modelo: string; anio: number | null; placas: string | null; color: string | null
  tipo: string; aseguradora_nombre: string | null; cliente_nombre: string; fecha_ingreso: string; etapa: Etapa; foto_portada: string | null; retrasado: boolean
}

/** "Hoy · 10:52 a. m.", "Ayer · 4:15 p. m." o "vie 13 nov · 10:52 a. m." — siempre en hora del taller (Ciudad de México) */
const TZ = 'America/Mexico_City'
export function fechaHoraIngreso(iso: string) {
  const d = new Date(iso)
  const dia = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: TZ })
  const hoy = new Date(), ayer = new Date(Date.now() - 86400000)
  const h = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  if (dia(d) === dia(hoy)) return `Hoy · ${h}`
  if (dia(d) === dia(ayer)) return `Ayer · ${h}`
  return `${d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).replace(/\./g, '')} · ${h}`
}

export function EtiquetaEtapa({ etapa, retrasado }: { etapa: string; retrasado?: boolean }) {
  const e = ETAPAS[etapa as Etapa]
  if (retrasado) return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-700 ring-1 ring-red-200">Retrasado · {e?.label ?? etapa}</span>
  return <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: `${e?.color ?? '#64748b'}1a`, color: e?.color ?? '#475569' }}>{e?.label ?? etapa}</span>
}

/** Últimos vehículos ingresados, con foto, fecha y hora (se actualiza junto con el tablero) */
export default function Recientes({ actualizado, cuantos = 6 }: { actualizado?: string; cuantos?: number }) {
  const [rows, setRows] = useState<Ingreso[] | null>(null)
  useEffect(() => {
    supabase.from('v_ordenes').select('id,folio,marca,modelo,anio,placas,color,tipo,aseguradora_nombre,cliente_nombre,fecha_ingreso,etapa,foto_portada,retrasado')
      .neq('etapa', 'cancelado').order('fecha_ingreso', { ascending: false }).limit(cuantos)
      .then(({ data }) => setRows((data ?? []) as Ingreso[]))
  }, [actualizado, cuantos])

  return (
    <Panel titulo="Recién ingresados" sub="Los últimos vehículos que entraron al taller">
      {!rows ? <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#eef6f8]" />)}</div>
        : rows.length === 0 ? <p className="py-4 text-center text-[15px] text-[#4f6672]">Aún no hay ingresos.</p> : (
        <ul className="-mx-1 divide-y divide-black/[.05]">
          {rows.map(r => (
            <li key={r.id}>
              <a href={`${BASE}ordenes/${r.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl px-1 py-3 active:bg-black/[.03]">
                <Miniatura path={r.foto_portada} auto={r} className="h-[72px] w-[96px] !rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="text-[17px] text-[#193344]">{r.folio}</b><EtiquetaEtapa etapa={r.etapa} retrasado={r.retrasado} /></div>
                  <div className="truncate text-[15px] font-medium text-[#193344]">{r.marca} {r.modelo} {r.anio ?? ''}</div>
                  <div className="truncate text-[14px] text-[#4f6672]">{r.placas ?? 'Sin placas'} · {r.tipo === 'aseguradora' ? r.aseguradora_nombre ?? 'Aseguradora' : 'Particular'}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[13.5px] font-semibold text-[#17657c]"><Clock className="h-3.5 w-3.5" /> {fechaHoraIngreso(r.fecha_ingreso)}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#8aa2ad]" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Mapa id de orden → ruta de su foto de portada (para listas que no la traen) */
export function useFotosOrdenes(ids: number[]) {
  const [fotos, setFotos] = useState<Record<number, string | null>>({})
  const clave = ids.join(',')
  useEffect(() => {
    if (!ids.length) return
    supabase.from('v_ordenes').select('id,foto_portada,modelo,color').in('id', ids).then(({ data }) =>
      setFotos(Object.fromEntries((data ?? []).map(r => [r.id, r.foto_portada]))))
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  return fotos
}
