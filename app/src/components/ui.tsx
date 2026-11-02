import { useEffect, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X, Clock, AlertTriangle, ChevronRight, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
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
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-400">
      <Icon className="h-8 w-8" strokeWidth={1.5} />
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
export function Tabs({ tabs, param = 'tab' }: { tabs: { id: string; label: string; icon?: LucideIcon; count?: number; hidden?: boolean }[]; param?: string }) {
  const [sp, setSp] = useSearchParams()
  const visibles = tabs.filter(t => !t.hidden)
  const actual = sp.get(param) ?? visibles[0]?.id
  return (
    <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200">
        {visibles.map(t => (
          <button key={t.id} onClick={() => { const n = new URLSearchParams(); n.set(param, t.id); setSp(n) }}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${actual === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
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
    blue: 'bg-blue-100 text-blue-600', amber: 'bg-amber-100 text-amber-600', purple: 'bg-purple-100 text-purple-600',
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
    ? <Link to={to} className="card !p-4 transition hover:border-blue-300 hover:shadow-md">{body}</Link>
    : <div className="card !p-4">{body}</div>
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>
}
