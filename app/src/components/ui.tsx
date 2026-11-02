import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { iconoDeRuta } from '../lib/navegacion'
import { X, Clock, AlertTriangle, ChevronRight, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Encabezado corporativo de cada módulo: ícono, título, subtítulo, acciones e imagen del taller en tonos verdes */
export function PageHeader({ title, subtitle, children, icon }: { title: string; subtitle?: ReactNode; children?: ReactNode; icon?: LucideIcon }) {
  const { pathname } = useLocation()
  const Icono = icon ?? iconoDeRuta(pathname)
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,20,.04),0_8px_24px_-12px_rgba(16,24,20,.12)]">
      <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[58%] object-cover object-[60%_50%] md:block [mask-image:linear-gradient(to_right,transparent,black_38%)]" />
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-white via-white/70 to-transparent md:block" />
      <div className="relative flex flex-wrap items-center gap-4 px-5 py-5 md:px-7 md:py-6">
        {Icono && <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 shadow-inner ring-1 ring-brand-200/60"><Icono className="h-7 w-7" /></div>}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-600 md:text-base">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${pad ? '' : '!p-0'} ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between gap-2 ${pad ? 'mb-4' : 'px-5 pt-5 pb-3'}`}>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`badge ${cls}`}>{children}</span>
}

export function Field({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Empty({ children, icon: Icon = Inbox }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-400">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100"><Icon className="h-7 w-7 text-slate-300" strokeWidth={1.5} /></span>
      <div>{children}</div>
    </div>
  )
}

export function ErrorMsg({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
    </div>
  )
}

export function OkMsg({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>
}

/** Marca una función aún no implementada. Nunca simula funcionar. */
export function Pendiente({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <span><b className="text-slate-600">Pendiente de implementar:</b> {children}</span>
    </div>
  )
}

export function SinPermiso({ que = 'esta sección' }: { que?: string }) {
  return <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Tu rol no tiene permiso para consultar {que}.</div>
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-start sm:overflow-y-auto sm:p-6" onMouseDown={onClose}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:mt-8 sm:max-h-none sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onMouseDown={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Pestañas internas sincronizadas con la URL (?tab=) para poder compartir enlaces directos */
/** Pestañas internas sincronizadas con la URL (?tab=) para poder compartir enlaces directos */
export function Tabs({ tabs, param = 'tab' }: { tabs: { id: string; label: string; icon?: LucideIcon; count?: number; hidden?: boolean }[]; param?: string }) {
  const [sp, setSp] = useSearchParams()
  const visibles = tabs.filter(t => !t.hidden)
  const actual = sp.get(param) ?? visibles[0]?.id
  return (
    <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200 md:min-w-0 md:rounded-2xl md:border md:border-slate-200/70 md:bg-white md:p-1.5 md:shadow-sm">
        {visibles.map(t => (
          <button key={t.id} onClick={() => { const n = new URLSearchParams(); n.set(param, t.id); setSp(n) }}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition md:mb-0 md:rounded-xl md:border-b-0 ${actual === t.id
              ? 'border-brand-600 text-brand-700 md:bg-gradient-to-r md:from-brand-600 md:to-brand-500 md:text-white md:shadow-md md:shadow-brand-900/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 md:hover:bg-slate-50'}`}>
            {t.icon && <t.icon className="h-4 w-4" />}{t.label}
            {!!t.count && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
export function useTab(def: string, param = 'tab') {
  const [sp] = useSearchParams()
  return sp.get(param) ?? def
}

export function KpiCard({ icon: Icon, value, label, tone, to, hint }: {
  icon: LucideIcon; value: ReactNode; label: string; to?: string; hint?: ReactNode
  tone: 'blue' | 'amber' | 'purple' | 'sky' | 'green' | 'red' | 'slate' | 'orange' | 'cyan' | 'indigo'
}) {
  const tones = {
    blue: 'bg-brand-100 text-brand-700', amber: 'bg-amber-100 text-amber-600', purple: 'bg-purple-100 text-purple-600',
    sky: 'bg-sky-100 text-sky-600', green: 'bg-green-100 text-green-600', red: 'bg-red-100 text-red-600',
    slate: 'bg-slate-100 text-slate-600', orange: 'bg-orange-100 text-orange-600', cyan: 'bg-cyan-100 text-cyan-700', indigo: 'bg-indigo-100 text-indigo-600',
  }
  const body = (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${tones[tone]}`}><Icon className="h-5 w-5 sm:h-6 sm:w-6" /></div>
      <div className="min-w-0 flex-1">
        <div className={`text-2xl font-extrabold leading-tight ${tone === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
        <div className={`line-clamp-2 text-xs leading-tight font-medium ${tone === 'red' ? 'text-red-600' : 'text-slate-500'}`}>{label}</div>
        {hint && <div className="truncate text-[11px] text-slate-400">{hint}</div>}
      </div>
      {to && <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />}
    </div>
  )
  return to
    ? <Link to={to} className="card !p-4 transition hover:border-brand-300 hover:shadow-md">{body}</Link>
    : <div className="card !p-4">{body}</div>
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>
}
