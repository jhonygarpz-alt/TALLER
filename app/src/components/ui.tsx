import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { iconoDeRuta } from '../lib/navegacion'
import { X, Clock, AlertTriangle, ChevronRight, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Encabezado de cada módulo: banda con degradado azul profundo → petróleo → turquesa, ícono, título, subtítulo y acciones */
export function PageHeader({ title, subtitle, children, icon }: { title: string; subtitle?: ReactNode; children?: ReactNode; icon?: LucideIcon }) {
  const { pathname } = useLocation()
  const Icono = icon ?? iconoDeRuta(pathname)
  return (
    <div className="relative mb-6 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#102c43] via-[#17657c] to-[#2298af] text-white shadow-[0_18px_40px_-22px_rgba(16,44,67,.8)] ring-1 ring-white/10">
      <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[46%] object-cover object-[60%_50%] opacity-35 mix-blend-luminosity md:block [mask-image:linear-gradient(to_right,transparent,black_45%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/3 h-48 w-96 rounded-full bg-[#4fc0d5]/20 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4 px-5 py-5 md:px-7 md:py-6">
        {Icono && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20 backdrop-blur"><Icono className="h-6 w-6" strokeWidth={1.8} /></div>}
        <div className="min-w-[200px] flex-1">
          <h1 className="text-[22px] font-bold tracking-[-.01em] md:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-[#d7eef3]/85 md:text-[15px]">{subtitle}</p>}
        </div>
        {children && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">{children}</div>}
      </div>
    </div>
  )
}

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${pad ? '' : '!p-0'} ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between gap-2 ${pad ? 'mb-4' : 'px-5 pt-5 pb-3'}`}>
          <h2 className="text-[15px] font-bold tracking-[-.005em] text-[#193344]">{title}</h2>
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
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-[#66818f]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#eef8fa] to-[#dcf0f4] ring-1 ring-[#c5e6ed]"><Icon className="h-7 w-7 text-[#55b6ca]" strokeWidth={1.5} /></span>
      <div className="max-w-sm">{children}</div>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b2133]/55 backdrop-blur-[2px] sm:items-start sm:overflow-y-auto sm:p-6" onMouseDown={onClose}>
      <div className={`max-h-[92vh] w-full animate-aparecer overflow-y-auto rounded-t-[24px] bg-white shadow-[0_30px_80px_-20px_rgba(11,33,51,.6)] ring-1 ring-[#dbe9ee] sm:mt-8 sm:max-h-none sm:rounded-[24px] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onMouseDown={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8f1f4] bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-[#193344]"><span className="h-5 w-1.5 rounded-full bg-gradient-to-b from-[#4fc0d5] to-[#17657c]" />{title}</h2>
          <button className="rounded-full p-1.5 text-[#8aa2ad] hover:bg-[#eef6f8] hover:text-[#193344]" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
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
      <div className="inline-flex min-w-full gap-1 rounded-full bg-[#102c43] p-1 shadow-[0_8px_20px_-12px_rgba(16,44,67,.7)] md:min-w-0">
        {visibles.map(t => (
          <button key={t.id} onClick={() => { const n = new URLSearchParams(); n.set(param, t.id); setSp(n) }}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition ${actual === t.id
              ? 'bg-gradient-to-b from-[#2bb0c8] to-[#1d8299] text-white shadow-[0_4px_12px_-4px_rgba(34,152,175,.8)]'
              : 'text-[#c5e6ed]/75 hover:bg-white/10 hover:text-white'}`}>
            {t.icon && <t.icon className="h-4 w-4" />}{t.label}
            {!!t.count && <span className="rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-[#17657c]">{t.count}</span>}
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

/** Tarjeta de indicador (DashboardCard): ícono, valor grande, etiqueta y, opcionalmente, comparativo y enlace */
export function KpiCard({ icon: Icon, value, label, tone, to, hint, delta }: {
  icon: LucideIcon; value: ReactNode; label: string; to?: string; hint?: ReactNode; delta?: { pct: number; bueno: 'sube' | 'baja' } | null
  tone: 'blue' | 'amber' | 'purple' | 'sky' | 'green' | 'red' | 'slate' | 'orange' | 'cyan' | 'indigo'
}) {
  const tones = {
    blue: 'from-[#e3f3f7] to-[#cfeaf0] text-[#17657c]', amber: 'from-amber-50 to-amber-100 text-amber-600', purple: 'from-violet-50 to-violet-100 text-violet-600',
    sky: 'from-sky-50 to-sky-100 text-sky-600', green: 'from-emerald-50 to-emerald-100 text-emerald-600', red: 'from-red-50 to-red-100 text-red-600',
    slate: 'from-slate-50 to-slate-100 text-slate-500', orange: 'from-orange-50 to-orange-100 text-orange-600', cyan: 'from-cyan-50 to-cyan-100 text-cyan-700', indigo: 'from-indigo-50 to-indigo-100 text-indigo-600',
  }
  const d = delta && isFinite(delta.pct) ? delta : null
  const favorable = d ? (d.pct === 0 ? null : (d.pct > 0) === (d.bueno === 'sube')) : null
  const body = (
    <div className="flex items-start gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b ring-1 ring-black/[.03] ${tones[tone]}`}><Icon className="h-[22px] w-[22px]" strokeWidth={1.8} /></div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[12.5px] leading-tight font-medium text-[#66818f]">{label}</div>
        <div className={`mt-1 text-[26px] leading-none font-bold tracking-tight ${tone === 'red' && value !== 0 ? 'text-red-600' : 'text-[#193344]'}`}>{value}</div>
        {(d || hint) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
            {d && <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${favorable == null ? 'bg-slate-100 text-slate-500' : favorable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {d.pct > 0 ? '▲' : d.pct < 0 ? '▼' : '='} {Math.abs(d.pct).toFixed(0)}%</span>}
            {hint && <span className="truncate text-[#8aa2ad]">{hint}</span>}
          </div>
        )}
      </div>
      {to && <ChevronRight className="mt-1 hidden h-4 w-4 shrink-0 text-[#a9c1ca] sm:block" />}
    </div>
  )
  return to
    ? <Link to={to} className="card !p-4 hover:-translate-y-0.5">{body}</Link>
    : <div className="card !p-4">{body}</div>
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>
}
