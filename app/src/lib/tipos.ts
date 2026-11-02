import type { Etapa } from './format'

export interface VOrden {
  id: number; folio: string; tipo: 'aseguradora' | 'particular'; aseguradora_id: number | null; asignacion_id: number | null
  siniestro: string | null; cliente_id: number; vehiculo_id: number; tipo_reparacion_id: number | null; etapa: Etapa
  asesor_id: string | null; kilometraje: number | null; fecha_ingreso: string; fecha_compromiso: string | null
  danos_reportados: string | null; checklist_recepcion: Record<string, string>; objetos: string | null
  detenido_material: boolean; motivo_retraso: string | null; fecha_terminacion: string | null; fecha_entrega: string | null
  recibio_nombre: string | null; checklist_calidad: Record<string, boolean>; satisfaccion: number | null
  encuesta_comentario: string | null; encuesta_fecha: string | null; ultima_actualizacion: string; created_at: string
  cliente_nombre: string; cliente_telefono: string | null; marca: string; modelo: string; anio: number | null
  placas: string | null; color: string | null; aseguradora_nombre: string | null; asesor_nombre: string | null
  tipo_reparacion_nombre: string | null; dias_en_taller: number; retrasado: boolean; entregado_a_tiempo: boolean
  foto_portada: string | null; actividades_pendientes: number; tecnicos_activos: string | null
}

export interface Rentabilidad {
  orden_id: number; folio: string; tipo: string; etapa: Etapa; fecha_ingreso: string; fecha_entrega: string | null
  autorizado: number; adicional: number; facturado: number; cobrado: number
  costo_pintura: number; costo_materiales: number; costo_refacciones: number; costo_destajos: number
  costo_mano_obra_adicional: number; costo_servicios_externos: number; costo_otros: number
  ingreso_reconocido: number; costos_directos: number; utilidad_bruta: number
  indirectos_asignados: number; indirectos_pct: number; utilidad_estimada: number; por_cobrar: number
}

export interface Material {
  id: number; codigo: string | null; descripcion: string; tipo: 'pintura' | 'material' | 'refaccion' | 'herramienta'; categoria: string | null
  unidad: string; existencia: number; costo_promedio: number; minimo: number; proveedor_id: number | null; activo: boolean
}
export interface Tecnico { id: number; nombre: string; area: string; perfil_id: string | null; activo: boolean; especialidad?: string | null; telefono?: string | null }
export interface Tarifa { id: number; area: string; actividad: string; importe: number; activo: boolean }
export interface Proveedor { id: number; nombre: string; contacto: string | null; telefono: string | null; email: string | null; rfc: string | null }

export const vehiculoTxt = (o: { marca: string; modelo: string; anio?: number | null }) => `${o.marca} ${o.modelo}${o.anio ? ' ' + o.anio : ''}`
