import { supabase } from '../lib/supabase'
import { errorTexto } from '../lib/format'

/** Acceso del cliente: sin usuario del sistema; un token emitido al validar teléfono + placas */
const LS = 'mi-auto-token'
export const leerToken = () => { try { return localStorage.getItem(LS) } catch { return null } }
export const guardarToken = (t: string | null) => { try { if (t) localStorage.setItem(LS, t); else localStorage.removeItem(LS) } catch { /* sin almacenamiento */ } }

export interface Paso { paso: number; titulo: string; detalle: string }
export interface OrdenCliente {
  id: number; folio: string; etapa: string; estado: Paso; aseguradora: string | null
  ingreso: string; compromiso: string | null; entrega: string | null; danos: string | null
  satisfaccion: number | null; encuesta_fecha: string | null
  historial: { fecha: string; etapa: string; estado: Paso }[]
}
export interface DatosCliente {
  cliente: { nombre: string } | null
  vehiculo: { marca: string; modelo: string; anio: number | null; placas: string | null; color: string | null } | null
  taller: { nombre: string; logo: string | null } | null
  ordenes: OrdenCliente[]
  avisos: number
}

export async function entrar(telefono: string, placas: string) {
  const { data, error } = await supabase.rpc('cliente_entrar', { p_telefono: telefono, p_placas: placas })
  if (error) throw new Error(errorTexto(error))
  if (data?.error) throw new Error(data.error)
  guardarToken(data.token)
  return data.token as string
}
export async function datos(token: string): Promise<DatosCliente> {
  const { data, error } = await supabase.rpc('cliente_datos', { p_token: token })
  if (error) { if (error.message.includes('SESION_VENCIDA')) { guardarToken(null); throw new Error('SESION_VENCIDA') } throw new Error(errorTexto(error)) }
  return data as DatosCliente
}
export async function enviarEncuesta(token: string, orden: number, calificacion: number, comentario: string) {
  const { error } = await supabase.rpc('cliente_encuesta', { p_token: token, p_orden: orden, p_calificacion: calificacion, p_comentario: comentario })
  if (error) throw new Error(errorTexto(error))
}
export async function salir(token: string) {
  await supabase.rpc('cliente_salir', { p_token: token }).then(() => {}, () => {})
  guardarToken(null)
}
export const logoUrl = (path?: string | null) => (path ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/marca/${path}` : null)

// ---- Avisos push ----
const VAPID_PUBLICA = 'BAhyA4ekPQcwk9-PcthLCDbqp8SRwlt-v9nExuGqsFdSrQdq13lxKUFz8BSEbFWSkcWaI709tn9H8liJglIfuQA'
const aBytes = (b64: string) => Uint8Array.from(atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
export const pushSoportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export async function activarAvisos(token: string) {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error(permiso === 'denied' ? 'Bloqueaste los avisos. Actívalos en los ajustes del navegador para esta app.' : 'No se otorgó el permiso de avisos.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.rpc('cliente_push_registrar', { p_token: token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (error) throw new Error(errorTexto(error))
}
