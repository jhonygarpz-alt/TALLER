import { useState } from 'react'
import { BellOff, BellRing, Loader2, Send, Share, SquarePlus } from 'lucide-react'
import { errorTexto } from '../lib/format'
import { Aviso, botonPrimario, botonSecundario } from '../movil/ui'
import { usePush } from './push'

/** Banner en "Mis trabajos" mientras las notificaciones no estén activas */
export function BannerNotificaciones() {
  const { estado, activar } = usePush()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (estado === 'activo' || estado === 'cargando' || estado === 'no_soportado') return null
  return (
    <div className="rounded-3xl bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><BellRing className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900">Avísame cuando me asignen un trabajo</div>
          {estado === 'requiere_instalar' ? (
            <p className="mt-0.5 text-sm text-slate-600">En iPhone primero instala la app: <Share className="inline h-4 w-4" /> Compartir → <SquarePlus className="inline h-4 w-4" /> Agregar a inicio, y ábrela desde el ícono.</p>
          ) : estado === 'bloqueado' ? (
            <p className="mt-0.5 text-sm text-slate-600">Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador o del celular para esta app.</p>
          ) : <p className="mt-0.5 text-sm text-slate-600">Recibe un aviso en tu celular con cada trabajo nuevo o retrabajo, aunque la app esté cerrada.</p>}
        </div>
      </div>
      {error && <div className="mt-3"><Aviso onClose={() => setError(null)}>{error}</Aviso></div>}
      {estado === 'inactivo' && (
        <button disabled={ocupado} onClick={async () => { setOcupado(true); setError(null); try { await activar() } catch (e) { setError(errorTexto(e)) } setOcupado(false) }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-bold text-white shadow-md shadow-amber-900/20 active:scale-[.98] disabled:opacity-60">
          {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />} Activar notificaciones
        </button>
      )}
    </div>
  )
}

/** Tarjeta en "Mi perfil": activar, probar y desactivar */
export function TarjetaNotificaciones() {
  const { estado, activar, desactivar, probar } = usePush()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null)
  async function hacer(id: string, f: () => Promise<unknown>, ok?: string) {
    setOcupado(id); setMsg(null)
    try { const r = await f(); if (ok) setMsg({ t: 'ok', m: typeof r === 'number' ? (r ? ok : 'No se encontró este celular registrado; desactiva y vuelve a activar.') : ok }) } catch (e) { setMsg({ t: 'error', m: errorTexto(e) }) }
    setOcupado(null)
  }
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
      <div className="mb-1 flex items-center gap-2 font-bold">{estado === 'activo' ? <BellRing className="h-5 w-5 text-brand-700" /> : <BellOff className="h-5 w-5 text-slate-400" />} Notificaciones</div>
      <p className="mb-3 text-sm text-slate-500">
        {estado === 'activo' ? 'Activas en este celular: te avisaremos de trabajos nuevos y retrabajos.'
          : estado === 'requiere_instalar' ? 'En iPhone, instala primero la app en tu pantalla de inicio y ábrela desde el ícono.'
          : estado === 'bloqueado' ? 'Bloqueadas. Permítelas en los ajustes del navegador/celular para esta app.'
          : estado === 'no_soportado' ? 'Este navegador no admite notificaciones. Usa Chrome (Android) o la app instalada (iPhone).'
          : 'Desactivadas en este celular.'}
      </p>
      {msg && <div className="mb-3"><Aviso tipo={msg.t === 'ok' ? 'ok' : 'error'} onClose={() => setMsg(null)}>{msg.m}</Aviso></div>}
      {estado === 'inactivo' && <button className={botonPrimario} disabled={!!ocupado} onClick={() => hacer('activar', activar, 'Notificaciones activadas')}>{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />} Activar notificaciones</button>}
      {estado === 'activo' && (
        <div className="space-y-2">
          <button className={botonSecundario} disabled={!!ocupado} onClick={() => hacer('probar', probar, 'Aviso de prueba enviado. Debe llegarte en unos segundos.')}>{ocupado === 'probar' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Enviar aviso de prueba</button>
          <button className={`${botonSecundario} text-slate-500`} disabled={!!ocupado} onClick={() => hacer('desactivar', desactivar, 'Notificaciones desactivadas en este celular')}><BellOff className="h-5 w-5" /> Desactivar en este celular</button>
        </div>
      )}
    </div>
  )
}
