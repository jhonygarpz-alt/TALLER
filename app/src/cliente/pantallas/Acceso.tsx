import { useState, type FormEvent } from 'react'
import { BellRing, CarFront, ClipboardCheck, Loader2, Phone, Star } from 'lucide-react'
import { Aviso } from '../../movil/ui'
import { entrar } from '../api'

const BASE = import.meta.env.BASE_URL

/** Acceso con teléfono registrado + placas */
export default function Acceso({ onListo }: { onListo: (token: string) => void }) {
  const [tel, setTel] = useState('')
  const [placas, setPlacas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault(); setError(null); setCargando(true)
    try { onListo(await entrar(tel, placas)) } catch (err) { setError((err as Error).message) }
    setCargando(false)
  }
  const input = 'block w-full rounded-2xl border border-slate-200 bg-white py-4 pr-4 pl-12 text-lg shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-navy-950">
      <img src={`${BASE}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-[48vh] w-full object-cover object-[65%_50%] opacity-55" />
      <div className="pointer-events-none absolute inset-0 h-[48vh] bg-gradient-to-b from-navy-950/30 via-navy-950/60 to-navy-950" />
      <div className="relative flex flex-1 flex-col items-center justify-end px-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-6 text-center text-white">
        <img src={`${BASE}cliente/icon-192.png`} alt="" className="mb-3 h-20 w-20 rounded-3xl shadow-[0_0_24px_rgba(79,192,213,.45)]" />
        <h1 className="text-[26px] leading-tight font-extrabold">Sigue la reparación<br />de tu vehículo</h1>
        <div className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2 text-[11px] text-cyan-50/90">
          {([[ClipboardCheck, 'Avance en vivo'], [BellRing, 'Aviso cuando esté listo'], [Star, 'Califica el servicio']] as [typeof Star, string][]).map(([I, t]) => (
            <div key={t} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-2 py-2.5 backdrop-blur"><I className="h-5 w-5" />{t}</div>
          ))}
        </div>
      </div>
      <form onSubmit={enviar} className="relative space-y-4 rounded-t-[32px] bg-slate-50 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <div><h2 className="text-xl font-bold text-slate-900">Ingresa a tu cuenta</h2><p className="text-sm text-slate-500">Usa el teléfono que diste en el taller y las placas de tu vehículo.</p></div>
        {error && <Aviso>{error}</Aviso>}
        <div className="relative"><Phone className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className={input} type="tel" inputMode="tel" autoComplete="tel" aria-label="Teléfono" placeholder="Teléfono a 10 dígitos" required value={tel} onChange={e => setTel(e.target.value)} /></div>
        <div className="relative"><CarFront className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input className={`${input} uppercase`} autoCapitalize="characters" aria-label="Placas" placeholder="Placas (ej. ABC123A)" required value={placas} onChange={e => setPlacas(e.target.value)} /></div>
        <button disabled={cargando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-900/30 active:scale-[.98] disabled:opacity-70">
          {cargando ? <><Loader2 className="h-5 w-5 animate-spin" /> Buscando tu vehículo…</> : 'Ver mi vehículo'}
        </button>
        <p className="text-center text-xs text-slate-400">Si cambiaste de teléfono, pide al taller que lo actualice.</p>
      </form>
    </div>
  )
}
