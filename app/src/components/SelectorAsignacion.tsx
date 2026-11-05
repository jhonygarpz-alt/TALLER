import { useEffect, useState } from 'react'
import { Check, ClipboardList, PlusCircle, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fecha, limpiaBusqueda } from '../lib/format'

export interface AsignacionSel {
  id: number; siniestro: string; asegurado: string; telefono: string | null; marca: string | null; modelo: string | null
  anio: number | null; placas: string | null; fecha_asignacion: string | null; estatus: string
}

/** Asignaciones pendientes de ingresar (sin orden) de una aseguradora */
export async function buscarAsignaciones(aseguradoraId: string, q: string) {
  let query = supabase.from('asignaciones').select('id,siniestro,asegurado,telefono,marca,modelo,anio,placas,fecha_asignacion,estatus')
    .eq('aseguradora_id', aseguradoraId).not('estatus', 'in', '(ingresado,cancelada)').order('fecha_asignacion', { ascending: false }).limit(30)
  const s = limpiaBusqueda(q)
  if (s) query = query.or(['siniestro', 'placas', 'asegurado', 'marca', 'modelo'].map(c => `${c}.ilike.%${s}%`).join(','))
  const { data } = await query
  return (data ?? []) as AsignacionSel[]
}

/** Si la asignación es nueva, la registra (o reutiliza la del mismo siniestro si aún no tiene orden) y devuelve su id */
export async function asegurarAsignacion(d: { aseguradora_id: number; siniestro: string; asegurado: string; telefono?: string | null; marca?: string; modelo?: string; anio?: number | null; placas?: string | null; asesor_id?: string | null }) {
  const sin = d.siniestro.trim()
  const { data: ya } = await supabase.from('asignaciones').select('id,estatus').eq('aseguradora_id', d.aseguradora_id).eq('siniestro', sin).maybeSingle()
  if (ya) {
    if (ya.estatus === 'ingresado') throw new Error(`El siniestro ${sin} ya está ligado a otra orden de trabajo.`)
    return ya.id as number
  }
  const { data, error } = await supabase.from('asignaciones').insert({
    aseguradora_id: d.aseguradora_id, siniestro: sin, asegurado: d.asegurado.trim() || '(sin nombre)', telefono: d.telefono || null,
    marca: d.marca || null, modelo: d.modelo || null, anio: d.anio ?? null, placas: d.placas?.toUpperCase() || null,
    fecha_asignacion: new Date().toLocaleDateString('en-CA'), asesor_id: d.asesor_id || null, estatus: 'cita_programada',
    notas: 'Registrada al recibir el vehículo',
  }).select('id').single()
  if (error) throw error
  return data.id as number
}

/**
 * Selector de la asignación de la aseguradora para la recepción: lista las asignaciones pendientes con búsqueda
 * (siniestro, placas, asegurado) y permite registrar una nueva si aún no está capturada.
 */
export function SelectorAsignacion({ aseguradoraId, seleccion, nueva, onElegir, onNueva, movil, bloqueado }: {
  aseguradoraId: string; seleccion: AsignacionSel | null; nueva: boolean
  onElegir: (a: AsignacionSel | null) => void; onNueva: (v: boolean) => void; movil?: boolean; bloqueado?: boolean
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AsignacionSel[] | null>(null)
  useEffect(() => {
    if (!aseguradoraId || seleccion || nueva) return
    setRows(null)
    const t = setTimeout(() => buscarAsignaciones(aseguradoraId, q).then(setRows), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [aseguradoraId, q, seleccion, nueva])

  const caja = movil ? 'rounded-2xl' : 'rounded-xl'
  if (seleccion) return (
    <div className={`flex items-start gap-3 border-2 border-brand-500 bg-brand-50 p-3 ${caja}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Check className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold text-slate-900">Siniestro {seleccion.siniestro}</div>
        <div className="truncate text-slate-600">{seleccion.asegurado} · {[seleccion.marca, seleccion.modelo, seleccion.anio].filter(Boolean).join(' ')} {seleccion.placas && `· ${seleccion.placas}`}</div>
        <div className="text-xs text-slate-500">Asignada {fecha(seleccion.fecha_asignacion)}</div>
      </div>
      {!bloqueado && <button type="button" onClick={() => onElegir(null)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white">Cambiar</button>}
    </div>
  )
  if (nueva) return (
    <div className={`flex items-center justify-between gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ${caja}`}>
      <span className="flex items-center gap-2"><PlusCircle className="h-4 w-4 shrink-0" /> Se registrará una asignación nueva con el siniestro que captures.</span>
      <button type="button" onClick={() => onNueva(false)} className="shrink-0 font-semibold underline">Elegir de la lista</button>
    </div>
  )
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por siniestro, placas o asegurado…"
          className={`w-full border border-slate-200 bg-white pr-9 pl-9 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ${movil ? 'rounded-2xl py-3.5 text-base' : 'rounded-lg py-2.5'}`} />
        {q && <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-slate-400" aria-label="Borrar"><X className="h-4 w-4" /></button>}
      </div>
      <div className={`max-h-72 divide-y divide-slate-100 overflow-y-auto border border-slate-200 bg-white ${caja}`}>
        {!rows ? <div className="p-4 text-center text-sm text-slate-400">Cargando asignaciones…</div>
          : rows.length === 0 ? <div className="flex flex-col items-center gap-1 p-4 text-center text-sm text-slate-500"><ClipboardList className="h-6 w-6 text-slate-300" />{q ? 'Ninguna asignación pendiente coincide' : 'No hay asignaciones pendientes'}</div>
          : rows.map(a => (
            <button key={a.id} type="button" onClick={() => onElegir(a)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50 active:bg-brand-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{a.siniestro}</div>
                <div className="truncate text-xs text-slate-500">{a.asegurado} · {[a.marca, a.modelo, a.anio].filter(Boolean).join(' ')} {a.placas && `· ${a.placas}`}</div>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{fecha(a.fecha_asignacion)}</span>
            </button>
          ))}
      </div>
      <button type="button" onClick={() => onNueva(true)} className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><PlusCircle className="h-4 w-4" /> No está en la lista: registrar asignación nueva</button>
    </div>
  )
}
