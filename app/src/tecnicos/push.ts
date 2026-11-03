import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Llave pública VAPID (es pública por diseño; la privada vive en Supabase Vault)
const VAPID_PUBLICA = 'BAhyA4ekPQcwk9-PcthLCDbqp8SRwlt-v9nExuGqsFdSrQdq13lxKUFz8BSEbFWSkcWaI709tn9H8liJglIfuQA'

function aBytes(b64: string) {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

export type EstadoPush = 'cargando' | 'no_soportado' | 'requiere_instalar' | 'bloqueado' | 'inactivo' | 'activo'

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Estado y acciones de las notificaciones push de este celular */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('cargando')

  const revisar = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setEstado(esIOS() && !instalada() ? 'requiere_instalar' : 'no_soportado')
    }
    if (Notification.permission === 'denied') return setEstado('bloqueado')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return setEstado('inactivo')
    // confirma que la suscripción esté guardada para este usuario
    const { count } = await supabase.from('push_suscripciones').select('id', { count: 'exact', head: true }).eq('endpoint', sub.endpoint)
    setEstado(count ? 'activo' : 'inactivo')
  }, [])
  useEffect(() => { revisar() }, [revisar])

  async function activar() {
    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') { await revisar(); throw new Error(permiso === 'denied' ? 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para esta app.' : 'No se otorgó el permiso de notificaciones.') }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) })
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const { data: u } = await supabase.auth.getUser()
    await supabase.from('push_suscripciones').delete().eq('endpoint', j.endpoint) // por si el celular era de otro usuario
    const { error } = await supabase.from('push_suscripciones').insert({ perfil_id: u.user?.id, app: 'tecnicos', endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) })
    if (error) throw error
    setEstado('activo')
  }

  async function desactivar() {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe() }
    setEstado('inactivo')
  }

  async function probar() {
    const { data, error } = await supabase.functions.invoke('notificar-push', { body: { tipo: 'prueba' } })
    if (error) throw error
    return (data as { enviados: number }).enviados
  }

  return { estado, activar, desactivar, probar, revisar }
}
