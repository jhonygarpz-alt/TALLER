const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const mxn2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const money = (n: unknown) => mxn.format(Number(n ?? 0))
export const money2 = (n: unknown) => mxn2.format(Number(n ?? 0))
export const num = (n: unknown, d = 2) => Number(n ?? 0).toLocaleString('es-MX', { maximumFractionDigits: d })
export const pct = (n: number) => (isFinite(n) ? `${n.toFixed(1)}%` : '—')

export function fecha(d?: string | null) {
  if (!d) return '—'
  const x = new Date(d.length === 10 ? d + 'T12:00:00' : d)
  return x.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function fechaHora(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export const hoyISO = () => new Date().toLocaleDateString('en-CA')
export const diasEntre = (a: string, b = new Date()) => Math.floor((b.getTime() - new Date(a).getTime()) / 86400000)

export type Etapa = 'recepcion' | 'diagnostico' | 'preparacion' | 'esperando_autorizacion' | 'en_reparacion' | 'hojalateria' | 'pintura' | 'detallado' | 'control_calidad' | 'listo_entrega' | 'entregado' | 'cancelado'
export const ETAPAS: Record<Etapa, { label: string; badge: string; color: string }> = {
  recepcion:              { label: 'Recepción',              badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',        color: '#0284c7' },
  diagnostico:            { label: 'Diagnóstico',            badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',    color: '#ca8a04' },
  esperando_autorizacion: { label: 'Pendiente de autorización', badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',  color: '#ea580c' },
  en_reparacion:          { label: 'En reparación',          badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',      color: '#2563eb' },
  hojalateria:            { label: 'Hojalatería',            badge: 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200',      color: '#0891b2' },
  preparacion:            { label: 'Preparación',            badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',  color: '#7c3aed' },
  pintura:                { label: 'Pintura',                badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',  color: '#9333ea' },
  detallado:              { label: 'Detallado',              badge: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',  color: '#4f46e5' },
  control_calidad:        { label: 'Control de calidad',     badge: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200',      color: '#0d9488' },
  listo_entrega:          { label: 'Listo para entrega',     badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',    color: '#16a34a' },
  entregado:              { label: 'Entregado',              badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',    color: '#64748b' },
  cancelado:              { label: 'Cancelado',              badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',        color: '#dc2626' },
}
export const ETAPAS_TABLERO: Etapa[] = ['recepcion', 'diagnostico', 'esperando_autorizacion', 'en_reparacion', 'hojalateria', 'preparacion', 'pintura', 'detallado', 'control_calidad', 'listo_entrega', 'entregado']
export const ETAPAS_ACTIVAS: Etapa[] = ETAPAS_TABLERO.filter(e => e !== 'entregado')

export const ESTATUS_CONTACTO: Record<string, { label: string; badge: string }> = {
  sin_contactar:      { label: 'Sin contactar',      badge: 'bg-red-100 text-red-700' },
  no_localizado:      { label: 'No localizado',      badge: 'bg-orange-100 text-orange-800' },
  contactado:         { label: 'Contactado',         badge: 'bg-blue-100 text-blue-700' },
  cita_programada:    { label: 'Cita programada',    badge: 'bg-purple-100 text-purple-700' },
  cita_no_concretada: { label: 'Cita no concretada', badge: 'bg-slate-200 text-slate-700' },
  ingresado:          { label: 'Ingresado',          badge: 'bg-green-100 text-green-700' },
  cancelada:          { label: 'Cancelada',          badge: 'bg-slate-100 text-slate-500' },
}

export const AREAS: Record<string, string> = { mecanica: 'Mecánica', hojalateria: 'Hojalatería', pintura: 'Pintura', armado: 'Armado', detallado: 'Detallado', otros: 'Otros' }
export const CONCEPTOS: Record<string, string> = { mano_obra: 'Mano de obra', refaccion: 'Refacción', pintura: 'Pintura', material: 'Material', externo: 'Servicio externo' }
export const TIPOS_MATERIAL: Record<string, string> = { pintura: 'Pintura', material: 'Material / consumible', refaccion: 'Refacción', herramienta: 'Herramienta' }

export const ESTADO_ACTIVIDAD: Record<string, { label: string; badge: string }> = {
  asignada:   { label: 'Asignada',   badge: 'bg-slate-100 text-slate-700' },
  en_proceso: { label: 'En proceso', badge: 'bg-blue-100 text-blue-700' },
  terminada:  { label: 'Por validar', badge: 'bg-amber-100 text-amber-800' },
  validada:   { label: 'Validada',   badge: 'bg-green-100 text-green-700' },
  cancelada:  { label: 'Cancelada',  badge: 'bg-red-100 text-red-700' },
}
export const ESTADO_DESTAJO: Record<string, { label: string; badge: string }> = {
  pendiente:  { label: 'Pendiente de autorizar', badge: 'bg-amber-100 text-amber-800' },
  autorizado: { label: 'Autorizado (por pagar)', badge: 'bg-blue-100 text-blue-700' },
  pagado:     { label: 'Pagado',                 badge: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',              badge: 'bg-red-100 text-red-700' },
}
export const ESTADO_SOLICITUD: Record<string, { label: string; badge: string }> = {
  solicitada: { label: 'Por autorizar', badge: 'bg-amber-100 text-amber-800' },
  autorizada: { label: 'Por entregar',  badge: 'bg-blue-100 text-blue-700' },
  entregada:  { label: 'Entregada',     badge: 'bg-green-100 text-green-700' },
  rechazada:  { label: 'Rechazada',     badge: 'bg-red-100 text-red-700' },
}
export const ESTADO_COMPRA: Record<string, { label: string; badge: string }> = {
  requisicion:   { label: 'Requisición',          badge: 'bg-slate-100 text-slate-700' },
  por_autorizar: { label: 'Por autorizar',        badge: 'bg-amber-100 text-amber-800' },
  autorizada:    { label: 'Autorizada (por recibir)', badge: 'bg-blue-100 text-blue-700' },
  recibida:      { label: 'Recibida',             badge: 'bg-green-100 text-green-700' },
  cancelada:     { label: 'Cancelada',            badge: 'bg-red-100 text-red-700' },
}
export const ESTADO_PRESUPUESTO: Record<string, { label: string; badge: string }> = {
  borrador:   { label: 'Borrador',   badge: 'bg-slate-100 text-slate-700' },
  enviado:    { label: 'Enviado',    badge: 'bg-amber-100 text-amber-800' },
  autorizado: { label: 'Autorizado', badge: 'bg-green-100 text-green-700' },
  rechazado:  { label: 'Rechazado',  badge: 'bg-red-100 text-red-700' },
}
export const ROLES: Record<string, string> = {
  direccion: 'Dirección', administracion: 'Administración / Valuación', supervisor: 'Supervisor de taller',
  compras: 'Compras y almacén', asesor: 'Asesor de servicio', tecnico: 'Técnico',
}

/** Limpia texto para filtros .or() de PostgREST */
export const limpiaBusqueda = (s: string) => s.replace(/[,()%*\\]/g, ' ').trim()

/** Convierte '' en null */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = v === '' ? null : v
  return out as T
}

export function errorTexto(e: unknown): string {
  if (!e) return ''
  const m = (e as { message?: string }).message ?? String(e)
  if (m.includes('row-level security')) return 'No tienes permiso para realizar esta operación.'
  if (m.includes('ordenes_folio_key')) return 'Ese folio ya lo tiene otra orden. Escribe uno distinto o déjalo vacío para usar el consecutivo.'
  if (m.includes('duplicate key')) return 'Ya existe un registro con esos datos.'
  return m
}
