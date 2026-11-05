import { useEffect, useState } from 'react'
import { BellOff, BellRing, Download, ExternalLink, Loader2, LogOut, Send, Share, SquarePlus } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { errorTexto, ROLES } from '../../lib/format'
import { useInstalar } from '../../movil/ui'
import { usePush } from '../../tecnicos/push'
import { Panel } from '../graficas'

const BASE = import.meta.env.BASE_URL
const AVISOS = [
  { id: 'ingreso', label: 'Ingreso de vehículo', sub: 'Cada vez que se abre una orden de trabajo' },
  { id: 'entrega', label: 'Vehículo entregado', sub: 'Con los días que estuvo en el taller' },
  { id: 'encuesta', label: 'Calificación baja', sub: 'Encuestas de 3 estrellas o menos' },
  { id: 'resumen', label: 'Resumen del día', sub: 'Todos los días a las 7:10 p. m.' },
]

function Interruptor({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-emerald-400 shadow-[0_0_12px_rgba(46,232,111,.5)]' : 'bg-white/15'} disabled:opacity-50`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function Notificaciones() {
  const { estado, activar, desactivar, probar } = usePush('gerencia')
  const [avisos, setAvisos] = useState<string[] | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; m: string } | null>(null)

  async function endpoint() { const reg = await navigator.serviceWorker.getRegistration(); return (await reg?.pushManager.getSubscription())?.endpoint }
  useEffect(() => {
    if (estado !== 'activo') return
    endpoint().then(async ep => {
      if (!ep) return
      const { data } = await supabase.from('push_suscripciones').select('avisos').eq('endpoint', ep).maybeSingle()
      setAvisos(data?.avisos ?? AVISOS.map(a => a.id))
    })
  }, [estado])

  async function hacer(id: string, f: () => Promise<unknown>, ok?: string) {
    setOcupado(id); setMsg(null)
    try { const r = await f(); if (ok) setMsg({ ok: true, m: typeof r === 'number' && !r ? 'No se encontró este celular registrado; desactiva y vuelve a activar.' : ok }) } catch (e) { setMsg({ ok: false, m: errorTexto(e) }) }
    setOcupado(null)
  }
  async function cambiar(id: string, on: boolean) {
    const nuevos = on ? [...(avisos ?? []), id] : (avisos ?? []).filter(a => a !== id)
    const ep = await endpoint(); if (!ep) return
    setAvisos(nuevos)
    const { error } = await supabase.from('push_suscripciones').update({ avisos: nuevos }).eq('endpoint', ep)
    if (error) setMsg({ ok: false, m: errorTexto(error) })
  }

  return (
    <Panel titulo={<span className="flex items-center gap-2">{estado === 'activo' ? <BellRing className="h-5 w-5 text-emerald-300" /> : <BellOff className="h-5 w-5 text-slate-500" />} Notificaciones push</span>}
      sub={estado === 'activo' ? 'Activas en este celular' : estado === 'requiere_instalar' ? 'En iPhone instala la app primero y ábrela desde el ícono' : estado === 'bloqueado' ? 'Bloqueadas: permítelas en los ajustes del celular para esta app' : estado === 'no_soportado' ? 'Este navegador no admite notificaciones' : 'Desactivadas en este celular'}>
      {msg && <div className={`mb-3 rounded-2xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>{msg.m}</div>}
      {estado === 'requiere_instalar' && <p className="mb-3 text-sm text-slate-400"><Share className="inline h-4 w-4" /> Compartir → <SquarePlus className="inline h-4 w-4" /> Agregar a inicio.</p>}
      {estado === 'inactivo' && (
        <button disabled={!!ocupado} onClick={() => hacer('activar', activar, 'Notificaciones activadas')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 py-3.5 font-bold text-[#04140b] shadow-[0_0_20px_rgba(46,232,111,.4)] active:scale-[.98] disabled:opacity-60">
          {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />} Activar notificaciones
        </button>
      )}
      {estado === 'activo' && (
        <>
          <ul className="mb-3 divide-y divide-white/[.06]">
            {AVISOS.map(a => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{a.label}</div><div className="text-xs text-slate-400">{a.sub}</div></div>
                <Interruptor on={!!avisos?.includes(a.id)} disabled={!avisos} onChange={v => cambiar(a.id, v)} />
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!!ocupado} onClick={() => hacer('probar', probar, 'Aviso de prueba enviado; llega en unos segundos.')} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white active:bg-white/15">{ocupado === 'probar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Probar</button>
            <button disabled={!!ocupado} onClick={() => hacer('desactivar', desactivar, 'Notificaciones desactivadas')} className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-slate-400 active:bg-white/10"><BellOff className="h-4 w-4" /> Desactivar</button>
          </div>
        </>
      )}
    </Panel>
  )
}

export default function Ajustes() {
  const { perfil, session } = useAuth()
  const { puedeInstalar, instalar } = useInstalar()
  return (
    <>
      <Panel>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 text-lg font-extrabold text-[#04140b]">{perfil?.nombre?.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>
          <div className="min-w-0"><div className="truncate font-bold text-white">{perfil?.nombre}</div><div className="truncate text-xs text-slate-400">{session?.user.email} · {ROLES[perfil?.rol ?? ''] ?? perfil?.rol}</div></div>
        </div>
      </Panel>
      <Notificaciones />
      {puedeInstalar && (
        <button onClick={instalar} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 font-semibold text-white active:bg-white/15"><Download className="h-5 w-5" /> Instalar la app en este celular</button>
      )}
      <a href={BASE} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3.5 font-semibold text-slate-200 active:bg-white/10"><ExternalLink className="h-5 w-5" /> Abrir el sistema web</a>
      <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold text-rose-300 active:bg-rose-500/10"><LogOut className="h-5 w-5" /> Cerrar sesión</button>
      <p className="text-center text-[11px] text-slate-600">Los indicadores salen en tiempo real del sistema y se actualizan cada minuto.</p>
    </>
  )
}
