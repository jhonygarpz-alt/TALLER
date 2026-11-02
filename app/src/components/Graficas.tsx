import { useState } from 'react'

export interface Dato { label: string; value: number; color: string; to?: string }

/** Dona con total al centro y leyenda con valores (los valores visibles cubren la lectura sin depender del color) */
export function Dona({ datos, centro = 'Total', onClick }: { datos: Dato[]; centro?: string; onClick?: (d: Dato) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = datos.reduce((s, d) => s + d.value, 0)
  const R = 60, r = 40, C = 2 * Math.PI * ((R + r) / 2)
  let acc = 0
  const gap = total > 0 && datos.filter(d => d.value > 0).length > 1 ? 2 : 0
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Distribución">
        <circle cx="70" cy="70" r={(R + r) / 2} fill="none" stroke="#eef2f7" strokeWidth={R - r} />
        {total > 0 && datos.map((d, i) => {
          if (d.value <= 0) return null
          const len = (d.value / total) * C
          const el = (
            <circle key={d.label} cx="70" cy="70" r={(R + r) / 2} fill="none" stroke={d.color} strokeWidth={hover === i ? R - r + 4 : R - r}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`} strokeDashoffset={-acc}
              className="cursor-pointer transition-all" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onClick?.(d)}><title>{`${d.label}: ${d.value}`}</title></circle>
          )
          acc += len
          return el
        })}
        <g className="rotate-90" style={{ transformOrigin: '70px 70px' }}>
          <text x="70" y="68" textAnchor="middle" className="fill-slate-900 text-[26px] font-extrabold">{hover !== null ? datos[hover].value : total}</text>
          <text x="70" y="86" textAnchor="middle" className="fill-slate-500 text-[10px]">{hover !== null ? datos[hover].label.slice(0, 18) : centro}</text>
        </g>
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {datos.map((d, i) => (
          <li key={d.label}>
            <button type="button" onClick={() => onClick?.(d)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-50">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 truncate text-slate-600">{d.label}</span>
              <span className="font-semibold text-slate-900">{d.value}</span>
              <span className="w-12 text-right text-xs text-slate-400">{total ? `${Math.round((d.value / total) * 100)}%` : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras verticales con valor directo sobre cada barra; un solo eje */
export function Barras({ datos, alto = 180, formato = (n: number) => String(n) }: { datos: Dato[]; alto?: number; formato?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...datos.map(d => d.value))
  const paso = Math.pow(10, Math.floor(Math.log10(max)))
  const tope = Math.max(4, Math.ceil(max / paso) * paso, Math.ceil(max / 4) * 4)
  const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map(f => Math.round(tope * f)))]
  return (
    <div className="flex gap-2" style={{ height: alto + 28 }}>
      <div className="flex flex-col justify-between pb-7 text-right text-[11px] text-slate-400" style={{ height: alto + 28 }}>
        {[...ticks].reverse().map(t => <span key={t} className="leading-none">{formato(t)}</span>)}
      </div>
      <div className="relative flex flex-1 items-end gap-2 border-l border-slate-200 pl-2 sm:gap-3">
        {ticks.slice(1).map(t => (
          <div key={t} className="pointer-events-none absolute right-0 left-0 border-t border-slate-100" style={{ bottom: 28 + (t / tope) * alto }} />
        ))}
        {datos.map((d, i) => (
          <div key={d.label} className="relative z-10 flex flex-1 flex-col items-center justify-end" style={{ height: alto + 28 }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="mb-1 text-xs font-bold text-slate-700">{formato(d.value)}</span>
            <div className="w-full max-w-12 rounded-t transition-opacity" title={`${d.label}: ${formato(d.value)}`}
              style={{ height: Math.max((d.value / tope) * alto, d.value > 0 ? 3 : 0), background: d.color, opacity: hover === null || hover === i ? 1 : 0.55 }} />
            <span className="mt-1 h-6 w-full truncate text-center text-[11px] leading-6 text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
