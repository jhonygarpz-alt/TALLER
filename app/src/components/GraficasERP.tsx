import { useState, type ReactNode } from 'react'
import { BarChart3, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Paleta del ERP: azul profundo, petróleo, turquesa y semánticos discretos */
export const P = {
  profundo: '#102c43', petroleo: '#17657c', turquesa: '#2298af', cian: '#7fcfdf', hielo: '#c5e6ed',
  verde: '#2fa37a', ambar: '#e6a53a', rojo: '#d9595b', azul: '#3f7fd0', gris: '#b8c9d0', texto: '#193344', suave: '#66818f',
}
export const SERIE_ERP = [P.petroleo, P.turquesa, P.cian, P.ambar, P.verde, P.azul, '#8e7cc3', P.gris]

/** Contenedor de gráfica (ChartContainer) con título, subtítulo, acción y estado vacío */
export function ChartContainer({ titulo, sub, accion, vacio, iconoVacio = BarChart3, children, className = '' }: {
  titulo: ReactNode; sub?: ReactNode; accion?: ReactNode; vacio?: string | false; iconoVacio?: LucideIcon; children: ReactNode; className?: string
}) {
  const Icono = iconoVacio
  return (
    <section className={`card flex flex-col ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-[15px] font-bold text-[#193344]">{titulo}</h2>{sub && <p className="text-[12.5px] text-[#66818f]">{sub}</p>}</div>
        {accion}
      </div>
      {vacio ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#eef8fa] to-[#dcf0f4] ring-1 ring-[#c5e6ed]"><Icono className="h-6 w-6 text-[#55b6ca]" strokeWidth={1.6} /></span>
          <p className="max-w-[260px] text-[13px] text-[#66818f]">{vacio}</p>
        </div>
      ) : <div className="flex-1">{children}</div>}
    </section>
  )
}

export function VerMas({ to, children = 'Ver detalle' }: { to: string; children?: ReactNode }) {
  return <Link to={to} className="shrink-0 rounded-full bg-[#eef6f8] px-3 py-1 text-[12px] font-semibold text-[#17657c] transition hover:bg-[#dcf0f4]">{children}</Link>
}

function curva(p: [number, number][]) {
  if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : ''
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    // puntos de control acotados: la curva nunca rebasa los valores reales
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]), ac = (v: number) => Math.min(hi, Math.max(lo, v))
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${ac(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${ac(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** Dos series (recibidas / finalizadas) en líneas suaves con área */
export function LineasDobles({ puntos, nombres = ['Recibidas', 'Finalizadas'] }: { puntos: { etiqueta: string; detalle: string; a: number; b: number }[]; nombres?: [string, string] }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 560, H = 200, pl = 28, pr = 10, pt = 12, pb = 24
  const n = puntos.length
  const max = Math.max(4, ...puntos.map(p => Math.max(p.a, p.b)))
  const paso = max <= 10 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20
  const tope = Math.ceil(max / paso) * paso
  const x = (i: number) => n === 1 ? (pl + W - pr) / 2 : pl + (W - pl - pr) * i / (n - 1)
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / tope)
  const pA = puntos.map((p, i) => [x(i), y(p.a)] as [number, number]), pB = puntos.map((p, i) => [x(i), y(p.b)] as [number, number])
  const area = (pts: [number, number][]) => `${curva(pts)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const cada = Math.ceil(n / 10)
  const s = sel != null ? puntos[sel] : null
  const ancho = (W - pl - pr) / Math.max(n - 1, 1)
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-[#193344]">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: P.petroleo }} />{nombres[0]} <b>{puntos.reduce((t, p) => t + p.a, 0)}</b></span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: P.turquesa }} />{nombres[1]} <b>{puntos.reduce((t, p) => t + p.b, 0)}</b></span>
        <span className="ml-auto text-[12px] text-[#66818f]">{s ? <><b className="text-[#193344]">{s.detalle}</b> · {s.a} {nombres[0].toLowerCase()} · {s.b} {nombres[1].toLowerCase()}</> : 'Pasa el cursor o toca la gráfica'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${nombres[0]} y ${nombres[1]}`} onMouseLeave={() => setSel(null)}>
        <defs>
          <linearGradient id="erpA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.petroleo} stopOpacity=".22" /><stop offset="1" stopColor={P.petroleo} stopOpacity="0" /></linearGradient>
          <linearGradient id="erpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.turquesa} stopOpacity=".25" /><stop offset="1" stopColor={P.turquesa} stopOpacity="0" /></linearGradient>
        </defs>
        {Array.from({ length: tope / paso + 1 }, (_, k) => k * paso).map(v => (
          <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#193344" strokeOpacity={v ? .06 : .14} /><text x={pl - 7} y={y(v) + 3} textAnchor="end" fontSize="10" fill={P.suave}>{v}</text></g>
        ))}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1={pt} y2={y(0)} stroke={P.turquesa} strokeOpacity=".35" strokeDasharray="3 3" />}
        <path d={area(pB)} fill="url(#erpB)" /><path d={area(pA)} fill="url(#erpA)" />
        <path d={curva(pB)} fill="none" stroke={P.turquesa} strokeWidth="2.4" strokeLinecap="round" />
        <path d={curva(pA)} fill="none" stroke={P.petroleo} strokeWidth="2.4" strokeLinecap="round" />
        {puntos.map((p, i) => (
          <g key={i}>
            {(n <= 16 || sel === i) && <>
              <circle cx={x(i)} cy={y(p.b)} r={sel === i ? 4.5 : 3} fill={P.turquesa} stroke="#fff" strokeWidth="1.5" />
              <circle cx={x(i)} cy={y(p.a)} r={sel === i ? 4.5 : 3} fill={P.petroleo} stroke="#fff" strokeWidth="1.5" />
            </>}
            {i % cada === 0 && <text x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill={P.suave}>{p.etiqueta}</text>}
            <rect x={x(i) - ancho / 2} y={0} width={ancho} height={H} fill="transparent" onMouseEnter={() => setSel(i)} onClick={() => setSel(i)} />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Dona con total al centro y leyenda (opcionalmente clicable) */
export function DonaERP({ datos, centro, sub, tam = 132, onClick }: { datos: { label: string; valor: number; color: string; extra?: string }[]; centro: ReactNode; sub?: string; tam?: number; onClick?: (i: number) => void }) {
  const total = datos.reduce((a, d) => a + d.valor, 0)
  const r = 15.9155, grosor = 4.6
  let acum = 0
  const visibles = datos.filter(d => d.valor > 0)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle cx="21" cy="21" r={r} fill="none" stroke="#e8f2f5" strokeWidth={grosor} />
          {total > 0 && visibles.map(d => {
            const p = (d.valor / total) * 100, hueco = visibles.length > 1 ? 1 : 0
            const el = <circle key={d.label} cx="21" cy="21" r={r} fill="none" stroke={d.color} strokeWidth={grosor} strokeDasharray={`${Math.max(p - hueco, .1)} ${100 - Math.max(p - hueco, .1)}`} strokeDashoffset={-acum} />
            acum += p
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><div className="text-[22px] leading-none font-bold text-[#193344]">{centro}</div>{sub && <div className="mt-1 text-[11px] text-[#66818f]">{sub}</div>}</div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {datos.map((d, i) => {
          const fila = <>
            <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-left text-[#193344]">{d.label}</span>
            <b className="font-semibold text-[#193344]">{d.extra ?? d.valor}</b>
            <span className="w-10 text-right text-[#66818f]">{total ? Math.round(d.valor / total * 100) : 0}%</span>
          </>
          return <li key={d.label}>{onClick
            ? <button onClick={() => onClick(i)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-[#f1f8fa]">{fila}</button>
            : <div className="flex items-center gap-2.5 px-2 py-1.5 text-[13px]">{fila}</div>}</li>
        })}
      </ul>
    </div>
  )
}

/** Barras horizontales */
export function BarrasERP({ datos, formato = (v: number) => String(v) }: { datos: { label: string; valor: number; color?: string; extra?: ReactNode; to?: string }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...datos.map(d => Math.abs(d.valor)))
  return (
    <ul className="space-y-3">
      {datos.map((d, i) => {
        const col = d.color ?? SERIE_ERP[i % SERIE_ERP.length]
        const cont = <>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]"><span className="truncate text-[#193344]">{d.label}</span><span className="shrink-0 font-semibold text-[#193344]">{formato(d.valor)}{d.extra}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e8f2f5]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, Math.abs(d.valor) / max * 100)}%`, background: `linear-gradient(90deg, ${col}aa, ${col})` }} /></div>
        </>
        return <li key={d.label + i}>{d.to ? <Link to={d.to} className="block rounded-lg transition hover:opacity-80">{cont}</Link> : cont}</li>
      })}
    </ul>
  )
}

/** Medidor semicircular (0–100 %) */
export function MedidorERP({ valor, etiqueta }: { valor: number | null; etiqueta: string }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor))
  const largo = Math.PI * 40
  const color = v >= 85 ? P.verde : v >= 60 ? P.ambar : P.rojo
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[170px]">
        <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke="#e8f2f5" strokeWidth="9" strokeLinecap="round" />
        {v > 0 && <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${largo * v / 100} ${largo}`} />}
        <text x="50" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill={P.texto}>{valor == null ? '—' : `${Math.round(v)}%`}</text>
      </svg>
      <div className="-mt-0.5 text-center text-[12px] text-[#66818f]">{etiqueta}</div>
    </div>
  )
}
