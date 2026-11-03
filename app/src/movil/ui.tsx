import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2, X } from 'lucide-react'
import { ETAPAS, type Etapa } from '../lib/format'

/** Barra superior fija con título y botón de regreso */
export function Barra({ titulo, sub, atras, accion }: { titulo: string; sub?: ReactNode; atras?: boolean | string; accion?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-navy-950 to-navy-800 pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-black/10">
      <div className="flex h-14 items-center gap-1 px-2">
        {atras ? (
          <button onClick={() => (typeof atras === 'string' ? nav(atras) : nav(-1))} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Regresar">
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : <div className="w-3" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] leading-tight font-bold">{titulo}</div>
          {sub && <div className="truncate text-xs text-emerald-100/75">{sub}</div>}
        </div>
        {accion}
      </div>
    </header>
  )
}

export function BadgeEtapa({ etapa, grande }: { etapa: Etapa; grande?: boolean }) {
  const e = ETAPAS[etapa]
  return <span className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${e.badge} ${grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`}>{e.label}</span>
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />{texto}</div>
}

export function Vacio({ icono: Icono, children }: { icono: typeof X; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center text-slate-400">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"><Icono className="h-8 w-8" /></div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function Aviso({ tipo = 'error', children, onClose }: { tipo?: 'error' | 'ok' | 'info'; children: ReactNode; onClose?: () => void }) {
  if (!children) return null
  const c = { error: 'bg-red-50 text-red-700 ring-red-200', ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200', info: 'bg-sky-50 text-sky-800 ring-sky-200' }[tipo]
  return (
    <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ring-1 ${c}`}>
      <div className="flex-1">{children}</div>
      {onClose && <button onClick={onClose} aria-label="Cerrar"><X className="h-4 w-4" /></button>}
    </div>
  )
}

/** Hoja que sube desde abajo (menús y formularios cortos) */
export function Hoja({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px]" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg animate-aparecer overflow-y-auto rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white px-5 pt-3 pb-2">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{titulo}</h2>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
        </div>
        <div className="px-5 pt-1">{children}</div>
      </div>
    </div>
  )
}

/** Campo con etiqueta para formularios móviles */
export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  )
}
export const entrada = 'block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'
export const botonPrimario = 'flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-[17px] font-bold text-white shadow-lg shadow-brand-900/25 transition active:scale-[.98] disabled:opacity-60'
export const botonSecundario = 'flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-base font-semibold text-slate-700 ring-1 ring-slate-200 transition active:scale-[.98] active:bg-slate-50 disabled:opacity-60'

/** Instalación de la app (Android/Chrome: evento beforeinstallprompt; iPhone: instrucciones) */
interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let eventoGuardado: EventoInstalar | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoGuardado = e as EventoInstalar; window.dispatchEvent(new Event('instalable')) })
}
export function useInstalar() {
  const [listo, setListo] = useState(!!eventoGuardado)
  const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  useEffect(() => { const f = () => setListo(true); window.addEventListener('instalable', f); return () => window.removeEventListener('instalable', f) }, [])
  async function instalar() {
    if (!eventoGuardado) return false
    await eventoGuardado.prompt(); await eventoGuardado.userChoice; eventoGuardado = null; setListo(false); return true
  }
  return { puedeInstalar: listo && !instalada, instalada, ios, instalar }
}
