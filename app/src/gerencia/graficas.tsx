import { useState, type ReactNode } from 'react'

// Paleta vibrante sobre fondo oscuro (verde neón del ícono + acentos)
export const C = { verde: '#2ee86f', cian: '#22d3ee', violeta: '#a78bfa', ambar: '#fbbf24', rosa: '#f472b6', azul: '#60a5fa', rojo: '#fb7185', gris: '#475569' }
export const SERIE = [C.verde, C.cian, C.violeta, C.ambar, C.rosa, C.azul, '#34d399', '#f97316', '#e879f9', '#38bdf8']

/** Tarjeta de vidrio oscuro */
export function Panel({ titulo, sub, derecha, children, className = '' }: { titulo?: ReactNode; sub?: ReactNode; derecha?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/[.07] bg-gradient-to-b from-white/[.06] to-white/[.02] p-4 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur ${className}`}>
      {(titulo || derecha) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div><h2 className="text-[15px] font-bold text-white">{titulo}</h2>{sub && <p className="text-xs text-slate-400">{sub}</p>}</div>
          {derecha}
        </div>
      )}
      {children}
    </section>
  )
}

/** Columnas (ingresos) + línea con área (entregas) por día; toca una columna para ver el detalle */
export function Tendencia({ serie }: { serie: { d: string; ingresos: number; entregas: number }[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 340, H = 170, pl = 22, pr = 6, pt = 12, pb = 22
  const n = serie.length
  const max = Math.max(1, ...serie.map(s => Math.max(s.ingresos, s.entregas)))
  const tope = Math.ceil(max / 2) * 2 || 2
  const ancho = (W - pl - pr) / n
  const x = (i: number) => pl + ancho * i + ancho / 2
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / tope)
  const linea = serie.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.entregas).toFixed(1)}`).join(' ')
  const area = `${linea} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const cada = Math.ceil(n / 8)
  const s = sel != null ? serie[sel] : null
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-300">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C.verde }} /> Ingresos</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded" style={{ background: C.cian }} /> Entregas</span>
        <span className="ml-auto text-slate-400">{s ? <><b className="text-white">{fechaCorta(s.d)}</b> · {s.ingresos} ing. · {s.entregas} ent.</> : 'Toca un día'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ingresos y entregas por día">
        <defs>
          <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.verde} /><stop offset="1" stopColor={C.verde} stopOpacity=".25" /></linearGradient>
          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.cian} stopOpacity=".35" /><stop offset="1" stopColor={C.cian} stopOpacity="0" /></linearGradient>
          <filter id="brillo"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, .5, 1].map(f => (
          <g key={f}>
            <line x1={pl} x2={W - pr} y1={y(tope * f)} y2={y(tope * f)} stroke="#ffffff" strokeOpacity=".07" strokeDasharray={f ? '3 4' : undefined} />
            <text x={pl - 5} y={y(tope * f) + 3} textAnchor="end" fontSize="8.5" fill="#94a3b8">{tope * f}</text>
          </g>
        ))}
        {serie.map((d, i) => {
          const hgt = y(0) - y(d.ingresos)
          return (
            <g key={d.d} onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer">
              <rect x={x(i) - ancho / 2} y={pt} width={ancho} height={H - pt - pb} fill={sel === i ? '#ffffff' : 'transparent'} fillOpacity=".05" />
              {d.ingresos > 0 && <rect x={x(i) - Math.min(9, ancho * .32)} y={y(d.ingresos)} width={Math.min(18, ancho * .64)} height={hgt} rx={Math.min(4, ancho * .2)} fill="url(#gCol)" opacity={sel == null || sel === i ? 1 : .45} />}
              {i % cada === 0 && <text x={x(i)} y={H - 7} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{Number(d.d.slice(8))}</text>}
            </g>
          )
        })}
        <path d={area} fill="url(#gArea)" pointerEvents="none" />
        <path d={linea} fill="none" stroke={C.cian} strokeWidth="2.2" strokeLinejoin="round" filter="url(#brillo)" pointerEvents="none" />
        {serie.map((d, i) => <circle key={d.d} cx={x(i)} cy={y(d.entregas)} r={sel === i ? 4 : n > 20 ? 0 : 2.4} fill="#0b1210" stroke={C.cian} strokeWidth="1.8" pointerEvents="none" />)}
      </svg>
    </div>
  )
}

/** Dona con total al centro */
export function Dona({ datos, centro, sub, tam = 132 }: { datos: { label: string; valor: number; color: string }[]; centro: ReactNode; sub?: string; tam?: number }) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  const r = 15.9155, grosor = 4.2
  let acum = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={r} fill="none" stroke="#ffffff" strokeOpacity=".07" strokeWidth={grosor} />
          {total > 0 && datos.filter(d => d.valor > 0).map(d => {
            const p = (d.valor / total) * 100
            const el = <circle key={d.label} cx="21" cy="21" r={r} fill="none" stroke={d.color} strokeWidth={grosor} strokeDasharray={`${Math.max(p - .8, .1)} ${100 - Math.max(p - .8, .1)}`} strokeDashoffset={-acum} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${d.color})` }} />
            acum += p
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-2xl font-extrabold text-white">{centro}</div>{sub && <div className="text-[10px] tracking-wide text-slate-400 uppercase">{sub}</div>}</div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {datos.map(d => (
          <li key={d.label} className="flex items-center gap-2">
            <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
            <span className="min-w-0 flex-1 truncate text-slate-300">{d.label}</span>
            <b className="text-white">{d.valor}</b>
            <span className="w-10 text-right text-xs text-slate-400">{total ? Math.round(d.valor / total * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras horizontales con degradado */
export function Barras({ datos, formato = (v: number) => String(v), vacio = 'Sin datos en el periodo' }: { datos: { label: string; valor: number; color?: string; extra?: ReactNode }[]; formato?: (v: number) => string; vacio?: string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  if (!datos.length) return <p className="py-4 text-center text-sm text-slate-500">{vacio}</p>
  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => {
        const col = d.color ?? SERIE[i % SERIE.length]
        return (
          <li key={d.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs"><span className="truncate text-slate-300">{d.label}</span><span className="shrink-0 font-bold text-white">{formato(d.valor)}{d.extra}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[.06]">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, d.valor / max * 100)}%`, background: `linear-gradient(90deg, ${col}55, ${col})`, boxShadow: `0 0 10px ${col}88` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Medidor semicircular (0–100 %) */
export function Medidor({ valor, etiqueta, color = C.verde }: { valor: number | null; etiqueta: string; color?: string }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor))
  const largo = Math.PI * 40
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[150px]">
        <defs><linearGradient id={`gm${etiqueta.length}`} x1="0" x2="1"><stop offset="0" stopColor={C.rojo} /><stop offset=".5" stopColor={C.ambar} /><stop offset="1" stopColor={color} /></linearGradient></defs>
        <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke="#ffffff" strokeOpacity=".08" strokeWidth="9" strokeLinecap="round" />
        <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke={`url(#gm${etiqueta.length})`} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${largo * v / 100} ${largo}`} style={{ filter: 'drop-shadow(0 0 3px rgba(46,232,111,.5))' }} />
        <text x="50" y="47" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">{valor == null ? '—' : `${Math.round(v)}%`}</text>
      </svg>
      <div className="-mt-0.5 text-center text-[11px] text-slate-400">{etiqueta}</div>
    </div>
  )
}

/** Barra apilada al 100 % (composición) */
export function Apilada({ datos }: { datos: { label: string; valor: number; color: string }[] }) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-white/[.06]">
        {total > 0 && datos.map(d => <div key={d.label} style={{ width: `${d.valor / total * 100}%`, background: d.color, boxShadow: `inset 0 0 6px rgba(0,0,0,.25)` }} />)}
      </div>
    </div>
  )
}

export function fechaCorta(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
