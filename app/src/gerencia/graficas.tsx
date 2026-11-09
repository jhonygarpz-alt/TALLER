import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

// Paleta fina sobre fondo gris suave: verdes del taller, lima, ámbar y gris perla
export const C = {
  oscuro: '#17657c', verde: '#2298af', medio: '#3aa9c0', lima: '#7fcfdf', ambar: '#efbd2f', gris: '#c4d4da',
  rojo: '#d65a52', ok: '#2fa37a', azul: '#4a86c8', teal: '#2f9c8c', texto: '#193344', suave: '#66818f',
}
export const SERIE = [C.verde, C.lima, C.ambar, C.teal, C.medio, C.azul, '#b3e0ea', '#8aa2ad']

/** Tarjeta blanca con sombra suave */
export function Panel({ titulo, sub, derecha, a, children, className = '' }: { titulo?: ReactNode; sub?: ReactNode; derecha?: ReactNode; a?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border border-black/[.035] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,.04),0_6px_18px_rgba(16,24,20,.05)] ${className}`}>
      {(titulo || derecha || a) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0"><h2 className="text-[17px] font-bold tracking-[-.01em] text-[#193344]">{titulo}</h2>{sub && <p className="text-[13px] text-[#66818f]">{sub}</p>}</div>
          {derecha}
          {a && <Link to={a} aria-label="Ver detalle" className="-mr-1 rounded-full p-1.5 text-[#193344] active:bg-black/5"><ChevronRight className="h-5 w-5" /></Link>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Curva suave (Catmull-Rom → Bézier) */
function curva(p: [number, number][]) {
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : ''
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    // puntos de control acotados entre los dos extremos: la curva nunca rebasa los valores reales (ni baja de cero)
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), acota = (v: number) => Math.min(hi, Math.max(lo, v))
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, acota(p1[1] + (p2[1] - p0[1]) / 6)], c2 = [p2[0] - (p3[0] - p1[0]) / 6, acota(p2[1] - (p3[1] - p1[1]) / 6)]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** Dos series en líneas suaves con área; toca un punto para ver el detalle */
export function Lineas({ serie, etiqueta, detalle }: { serie: { d: string; ingresos: number; entregas: number }[]; etiqueta: (d: string, i: number) => string; detalle: (d: string) => string }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 340, H = 168, pl = 24, pr = 8, pt = 10, pb = 22
  const n = serie.length
  const max = Math.max(4, ...serie.map(s => Math.max(s.ingresos, s.entregas)))
  const paso = max <= 10 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20
  const tope = Math.ceil(max / paso) * paso
  const x = (i: number) => n === 1 ? (pl + W - pr) / 2 : pl + (W - pl - pr) * i / (n - 1)
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / tope)
  const pI = serie.map((s, i) => [x(i), y(s.ingresos)] as [number, number])
  const pE = serie.map((s, i) => [x(i), y(s.entregas)] as [number, number])
  const area = (pts: [number, number][]) => `${curva(pts)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const cada = Math.ceil(n / 7)
  const puntos = n <= 14
  const s = sel != null ? serie[sel] : null
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ingresos y entregas">
        <defs>
          <linearGradient id="aI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.verde} stopOpacity=".22" /><stop offset="1" stopColor={C.verde} stopOpacity="0" /></linearGradient>
          <linearGradient id="aE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.lima} stopOpacity=".28" /><stop offset="1" stopColor={C.lima} stopOpacity="0" /></linearGradient>
        </defs>
        {Array.from({ length: tope / paso + 1 }, (_, k) => k * paso).map(v => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#193344" strokeOpacity={v ? .06 : .12} />
            <text x={pl - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.suave}>{v}</text>
          </g>
        ))}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1={pt} y2={y(0)} stroke={C.verde} strokeOpacity=".25" strokeDasharray="3 3" />}
        <path d={area(pE)} fill="url(#aE)" />
        <path d={area(pI)} fill="url(#aI)" />
        <path d={curva(pE)} fill="none" stroke={C.lima} strokeWidth="2.2" strokeLinecap="round" />
        <path d={curva(pI)} fill="none" stroke={C.oscuro} strokeWidth="2.2" strokeLinecap="round" />
        {serie.map((d, i) => (
          <g key={d.d}>
            {(puntos || sel === i) && <>
              <circle cx={x(i)} cy={y(d.entregas)} r={sel === i ? 4.5 : 3.4} fill={C.lima} stroke="#fff" strokeWidth="1.5" />
              <circle cx={x(i)} cy={y(d.ingresos)} r={sel === i ? 4.5 : 3.4} fill={C.oscuro} stroke="#fff" strokeWidth="1.5" />
            </>}
            {i % cada === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill={C.texto}>{etiqueta(d.d, i)}</text>}
            <rect x={x(i) - (W - pl - pr) / Math.max(n - 1, 1) / 2} y={0} width={(W - pl - pr) / Math.max(n - 1, 1)} height={H} fill="transparent" onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[13px] text-[#193344]">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: C.oscuro }} /> Ingresos ({serie.reduce((a, d) => a + d.ingresos, 0)})</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: C.lima }} /> Entregas ({serie.reduce((a, d) => a + d.entregas, 0)})</span>
      </div>
      <p className="mt-1 h-4 text-center text-[12px] text-[#66818f]">{s ? <><b className="text-[#193344]">{detalle(s.d)}</b> · {s.ingresos} ingresos · {s.entregas} entregas</> : 'Toca la gráfica para ver el detalle'}</p>
    </div>
  )
}

/** Mini línea de tendencia */
export function Chispa({ valores, color = C.medio }: { valores: number[]; color?: string }) {
  if (valores.length < 2) return null
  const max = Math.max(1, ...valores), W = 80, H = 22
  const p = valores.map((v, i) => [W * i / (valores.length - 1), H - 2 - (H - 4) * v / max] as [number, number])
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-4 w-14" aria-hidden><path d={curva(p)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>
}

/** Dona con total al centro */
export function Dona({ datos, centro, sub, tam = 120 }: { datos: { label: string; valor: number; color: string }[]; centro: ReactNode; sub?: string; tam?: number }) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  const r = 15.9155, grosor = 5.2
  let acum = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={r} fill="none" stroke="#e8f2f5" strokeWidth={grosor} />
          {total > 0 && datos.filter(d => d.valor > 0).map(d => {
            const p = (d.valor / total) * 100, hueco = datos.filter(x => x.valor > 0).length > 1 ? 1.2 : 0
            const el = <circle key={d.label} cx="21" cy="21" r={r} fill="none" stroke={d.color} strokeWidth={grosor} strokeDasharray={`${Math.max(p - hueco, .1)} ${100 - Math.max(p - hueco, .1)}`} strokeDashoffset={-acum} />
            acum += p
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><div className="text-[30px] leading-none font-bold tracking-tight text-[#193344]">{centro}</div>{sub && <div className="mt-1 text-[12px] text-[#193344]">{sub}</div>}</div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-[13px]">
        {datos.map(d => (
          <li key={d.label} className="flex items-center gap-2.5">
            <i className="h-3 w-3 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 leading-tight text-[#193344]">{d.label}</span>
            <b className="w-6 text-right font-semibold text-[#193344]">{d.valor}</b>
            <span className="w-10 text-right text-[#66818f]">{total ? Math.round(d.valor / total * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras horizontales */
export function Barras({ datos, formato = (v: number) => String(v), vacio = 'Sin datos en el periodo' }: { datos: { label: string; valor: number; color?: string; extra?: ReactNode }[]; formato?: (v: number) => string; vacio?: string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  if (!datos.length) return <p className="py-4 text-center text-sm text-[#66818f]">{vacio}</p>
  return (
    <ul className="space-y-3">
      {datos.map((d, i) => {
        const col = d.color ?? SERIE[i % SERIE.length]
        return (
          <li key={d.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]"><span className="truncate text-[#193344]">{d.label}</span><span className="shrink-0 font-semibold text-[#193344]">{formato(d.valor)}{d.extra}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e8f2f5]">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, d.valor / max * 100)}%`, background: col }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Medidor semicircular (0–100 %) */
export function Medidor({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor))
  const largo = Math.PI * 40
  const color = v >= 85 ? C.ok : v >= 60 ? C.ambar : C.rojo
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[150px]">
        <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke="#e8f2f5" strokeWidth="8" strokeLinecap="round" />
        {v > 0 && <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${largo * v / 100} ${largo}`} />}
        <text x="50" y="47" textAnchor="middle" fontSize="17" fontWeight="700" fill={C.texto}>{valor == null ? '—' : `${Math.round(v)}%`}</text>
      </svg>
      <div className="-mt-0.5 text-center text-[12px] text-[#66818f]">{etiqueta}</div>
    </div>
  )
}

/** Barra apilada al 100 % (composición) */
export function Apilada({ datos }: { datos: { label: string; valor: number; color: string }[] }) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-[#e8f2f5]">
      {total > 0 && datos.filter(d => d.valor > 0).map(d => <div key={d.label} style={{ width: `${d.valor / total * 100}%`, background: d.color }} />)}
    </div>
  )
}

export function fechaCorta(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
/** "Mar, 04 de Nov 2026" */
export function fechaLarga(iso: string) {
  const d = new Date(iso + 'T12:00:00Z')
  return `${DIAS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} de ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
