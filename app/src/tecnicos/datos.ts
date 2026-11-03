import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { subirFoto } from '../lib/storage'

export interface Trabajo {
  id: number; actividad: string; pieza: string | null; area: string; estado: string; importe_destajo: number
  orden_id: number; tecnico_id: number; fecha_asignacion: string; fecha_inicio: string | null; fecha_fin: string | null
  fecha_programada: string | null; rechazos: number; motivo_rechazo: string | null; horas: number | null
  ordenes: {
    folio: string; os_bitacora: string | null; etapa: string; fecha_compromiso: string | null; danos_reportados: string | null; prioridad: string | null
    vehiculos: { marca: string; modelo: string; anio: number | null; placas: string | null; color: string | null } | null
  } | null
}
export interface Avance { actividad_id: number; porcentaje: number; nota: string | null; created_at: string }

export const SELECT_TRABAJO = 'id,actividad,pieza,area,estado,importe_destajo,orden_id,tecnico_id,fecha_asignacion,fecha_inicio,fecha_fin,fecha_programada,rechazos,motivo_rechazo,horas,ordenes(folio,os_bitacora,etapa,fecha_compromiso,danos_reportados,prioridad,vehiculos(marca,modelo,anio,placas,color))'

/** Fichas de técnico ligadas al usuario (un usuario puede ser hojalatero y pintor) */
export function useMisFichas() {
  const { perfil } = useAuth()
  const [fichas, setFichas] = useState<{ id: number; nombre: string; area: string }[] | null>(null)
  useEffect(() => {
    supabase.from('tecnicos').select('id,nombre,area').eq('perfil_id', perfil?.id ?? '').eq('activo', true)
      .then(({ data }) => setFichas((data ?? []).map(t => ({ ...t, nombre: t.nombre.trim() }))))
  }, [perfil?.id])
  return fichas
}

/** Último avance y foto de portada de cada trabajo */
export async function cargarExtras(trabajos: Trabajo[]) {
  const ids = trabajos.map(t => t.id)
  const ords = [...new Set(trabajos.map(t => t.orden_id))]
  const [av, po] = await Promise.all([
    ids.length ? supabase.from('v_avance_actual').select('*').in('actividad_id', ids) : Promise.resolve({ data: [] as Avance[] }),
    ords.length ? supabase.from('v_ordenes').select('id,foto_portada').in('id', ords) : Promise.resolve({ data: [] as { id: number; foto_portada: string | null }[] }),
  ])
  return {
    avances: Object.fromEntries(((av.data ?? []) as Avance[]).map(a => [a.actividad_id, a])) as Record<number, Avance>,
    portadas: Object.fromEntries(((po.data ?? []) as { id: number; foto_portada: string | null }[]).map(o => [o.id, o.foto_portada])) as Record<number, string | null>,
  }
}

export const pctTrabajo = (t: Trabajo, av?: Avance) => (t.estado === 'terminada' || t.estado === 'validada' ? 100 : av?.porcentaje ?? 0)

/**
 * Registra el avance de un trabajo: lo inicia si estaba asignado, sube la foto (como evidencia del trabajo),
 * guarda el porcentaje y, si llega a 100% y se pide, lo marca como terminado (requiere foto de evidencia).
 */
export async function registrarAvance(t: Trabajo, porcentaje: number, nota: string, foto: File | null, terminar: boolean) {
  if (t.estado === 'asignada') {
    const { error } = await supabase.rpc('actividad_accion', { p_id: t.id, p_accion: 'iniciar' })
    if (error) throw error
  }
  let fotoId: number | null = null
  if (foto) {
    const path = await subirFoto(foto, t.orden_id, 'actividad', t.id, `Avance ${porcentaje}%${nota ? ` · ${nota}` : ''}`)
    const { data } = await supabase.from('fotos').select('id').eq('path', path).single()
    fotoId = data?.id ?? null
  }
  const { error } = await supabase.from('actividad_avances').insert({ actividad_id: t.id, porcentaje, nota: nota.trim() || null, foto_id: fotoId })
  if (error) throw error
  if (terminar) {
    const { error: e2 } = await supabase.rpc('actividad_accion', { p_id: t.id, p_accion: 'terminar' })
    if (e2) throw e2
  }
}
