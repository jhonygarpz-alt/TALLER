import { useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorTexto } from '../lib/format'
import { usePush } from '../tecnicos/push'
import { AVISOS_GERENCIA } from '../lib/avisos'
import { Modal } from './ui'

const BASE = import.meta.env.BASE_URL

async function endpoint() {
  const reg = await navigator.serviceWorker.getRegistration(BASE)
  return (await reg?.pushManager.getSubscription())?.endpoint
}

/** Notificaciones push del sistema web (Dirección y Gerencia) en esta computadora */
export default function AvisosWeb({ onClose }: { onClose: () => void }) {
  const { estado, activar, desactivar, probar } = usePush('web')
  const [avisos, setAvisos] = useState<string[] | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null)

  useEffect(() => {
    if (estado !== 'activo') return
    endpoint().then(async ep => {
      if (!ep) return
      const { data } = await supabase.from('push_suscripciones').select('avisos').eq('endpoint', ep).maybeSingle()
      setAvisos(data?.avisos ?? AVISOS_GERENCIA.map(a => a.id))
    })
  }, [estado])

  async function hacer(id: string, f: () => Promise<unknown>, ok: string) {
    setOcupado(id); setMsg(null)
    try { const r = await f(); setMsg({ ok: true, m: typeof r === 'number' && !r ? 'No se encontró esta computadora registrada; desactiva y vuelve a activar.' : ok }) } catch (e) { setMsg({ ok: false, m: errorTexto(e) }) }
    setOcupado(null)
  }
  async function cambiar(id: string, on: boolean) {
    const nuevos = on ? [...(avisos ?? []), id] : (avisos ?? []).filter(a => a !== id)
    const ep = await endpoint(); if (!ep) return
    setAvisos(nuevos)
    const { error } = await supabase.from('push_suscripciones').update({ avisos: nuevos }).eq('endpoint', ep)
    if (error) setMsg({ ok: false, m: errorTexto(error) })
  }

  const textoEstado = estado === 'activo' ? 'Activas en este navegador. Te llegan aunque el sistema esté en otra pestaña o minimizado (el navegador debe estar abierto).'
    : estado === 'bloqueado' ? 'El navegador las tiene bloqueadas: da clic en el candado junto a la dirección → Notificaciones → Permitir, y recarga.'
    : estado === 'no_soportado' || estado === 'requiere_instalar' ? 'Este navegador no admite notificaciones. Usa Chrome o Edge.'
    : estado === 'cargando' ? 'Revisando…' : 'Desactivadas en este navegador.'

  return (
    <Modal title="Notificaciones del taller" onClose={onClose}>
      <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#f1f8fa] p-3 text-sm text-[#36505e]">
        {estado === 'activo' ? <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[#2298af]" /> : <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-[#6f8792]" />}
        <p>{textoEstado}</p>
      </div>
      {msg && <div className={`mb-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.m}</div>}
      {estado === 'inactivo' && (
        <button className="btn-primary w-full justify-center" disabled={!!ocupado} onClick={() => hacer('activar', activar, 'Notificaciones activadas en esta computadora')}>
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Activar notificaciones
        </button>
      )}
      {estado === 'activo' && (
        <>
          <ul className="mb-4 divide-y divide-[#e8f1f4]">
            {AVISOS_GERENCIA.map(a => {
              const on = !!avisos?.includes(a.id)
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[#193344]">{a.label}</div><div className="text-xs text-[#66818f]">{a.sub}</div></div>
                  <button role="switch" aria-checked={on} aria-label={a.label} disabled={!avisos} onClick={() => cambiar(a.id, !on)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-[#2298af]' : 'bg-[#c4d4da]'} disabled:opacity-50`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" disabled={!!ocupado} onClick={() => hacer('probar', probar, 'Aviso de prueba enviado; llega en unos segundos.')}>{ocupado === 'probar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar prueba</button>
            <button className="btn-secondary text-red-600" disabled={!!ocupado} onClick={() => hacer('desactivar', desactivar, 'Notificaciones desactivadas en esta computadora')}><BellOff className="h-4 w-4" /> Desactivar</button>
          </div>
        </>
      )}
    </Modal>
  )
}
