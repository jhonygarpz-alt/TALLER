import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Camera, ChevronRight, Hammer, Loader2, Paintbrush, Play, Sparkles, TrendingUp, Wrench, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AREAS, errorTexto, fecha, money2 } from '../lib/format'
import { Miniatura } from '../components/Fotos'
import { Aviso, Hoja, botonPrimario, entrada } from '../movil/ui'
import { pctTrabajo, registrarAvance, type Avance, type Trabajo } from './datos'

export const ICONO_AREA: Record<string, typeof Wrench> = { hojalateria: Hammer, pintura: Paintbrush, detallado: Sparkles, mecanica: Wrench, otros: Wrench }
export const ESTADO_TEC: Record<string, [string, string]> = {
  asignada: ['Por hacer', 'bg-sky-100 text-sky-800'], en_proceso: ['En proceso', 'bg-amber-100 text-amber-800'],
  terminada: ['En revisión', 'bg-violet-100 text-violet-700'], validada: ['Validado', 'bg-emerald-100 text-emerald-800'], cancelada: ['Cancelado', 'bg-slate-200 text-slate-600'],
}

export function BarraAvance({ pct, grande }: { pct: number; grande?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 ${grande ? 'h-3' : 'h-2'}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 shadow-[0_0_8px_rgba(61,220,132,.6)] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-right font-extrabold text-brand-700 ${grande ? 'w-12 text-base' : 'w-9 text-xs'}`}>{pct}%</span>
    </div>
  )
}

/** Tarjeta de trabajo en la lista */
export function TarjetaTrabajo({ t, av, portada, onAvance, onIniciar, ocupado }: { t: Trabajo; av?: Avance; portada?: string | null; onAvance: () => void; onIniciar: () => void; ocupado: boolean }) {
  const v = t.ordenes?.vehiculos
  const Icono = ICONO_AREA[t.area] ?? Wrench
  const [lbl, cls] = ESTADO_TEC[t.estado] ?? [t.estado, '']
  const retrabajo = t.estado === 'en_proceso' && t.rechazos > 0 && t.motivo_rechazo
  return (
    <div className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${retrabajo ? 'ring-red-300' : 'ring-slate-200/80'}`}>
      {retrabajo && <div className="flex items-start gap-2 bg-red-50 px-4 py-2 text-xs text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Retrabajo:</b> {t.motivo_rechazo}</span></div>}
      <Link to={`/trabajo/${t.id}`} className="flex gap-3 p-3 active:bg-slate-50">
        <Miniatura auto={v ?? undefined} path={portada} className="h-[76px] w-[100px] rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[15px] leading-tight font-extrabold text-slate-900">{v ? `${v.marca} ${v.modelo}` : t.ordenes?.folio}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{lbl}</span>
          </div>
          <div className="truncate text-xs text-slate-500">{v?.placas ?? 's/placas'}{v?.color && ` · ${v.color}`} · {t.ordenes?.folio}{t.ordenes?.os_bitacora && ` · OS ${t.ordenes.os_bitacora}`}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-slate-700"><Icono className="h-4 w-4 text-brand-700" /><span className="truncate">{t.actividad}{t.pieza && ` · ${t.pieza}`}</span></div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 self-center text-slate-300" />
      </Link>
      <div className="space-y-2.5 border-t border-slate-100 px-4 pt-2.5 pb-3">
        <BarraAvance pct={pctTrabajo(t, av)} />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{AREAS[t.area]} · Destajo <b className="text-slate-700">{t.importe_destajo > 0 ? money2(t.importe_destajo) : 'sin tarifa'}</b></span>
          {t.ordenes?.fecha_compromiso && <span>Entrega {fecha(t.ordenes.fecha_compromiso)}</span>}
        </div>
        {t.estado === 'asignada' && <button disabled={ocupado} onClick={onIniciar} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 font-bold text-white active:scale-[.98] disabled:opacity-60">{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Iniciar trabajo</button>}
        {t.estado === 'en_proceso' && <button onClick={onAvance} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-3 font-bold text-white shadow-md shadow-brand-900/20 active:scale-[.98]"><TrendingUp className="h-5 w-5" /> Registrar avance</button>}
        {t.estado === 'terminada' && <div className="rounded-2xl bg-violet-50 px-3 py-2 text-center text-xs font-semibold text-violet-700">Terminado · el supervisor lo revisará para validarlo</div>}
      </div>
    </div>
  )
}

const RAPIDOS = [10, 25, 50, 75, 90, 100]

/** Hoja para registrar el avance (porcentaje + nota + foto). Al 100% exige foto y termina el trabajo. */
export function HojaAvance({ t, actual, onClose, onListo }: { t: Trabajo; actual: number; onClose: () => void; onListo: (msg: string) => void }) {
  const [pct, setPct] = useState(Math.min(100, Math.max(actual, actual < 100 ? Math.ceil((actual + 1) / 25) * 25 : 100)))
  const [nota, setNota] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const camara = useRef<HTMLInputElement>(null)
  const vista = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  const termina = pct === 100

  async function guardar() {
    if (pct < actual && !confirm(`El avance anterior era ${actual}%. ¿Registrar ${pct}%?`)) return
    if (termina && !foto) {
      const { count } = await supabase.from('fotos').select('id', { count: 'exact', head: true }).eq('categoria', 'actividad').eq('ref_id', t.id)
      if (!count) return setError('Para terminar al 100% toma una foto del trabajo terminado.')
    }
    setGuardando(true); setError(null)
    try {
      await registrarAvance(t, pct, nota, foto, termina)
      onListo(termina ? '¡Trabajo terminado! Quedó en revisión del supervisor.' : `Avance de ${pct}% registrado`)
    } catch (e) { setError(errorTexto(e)); setGuardando(false) }
  }

  return (
    <Hoja titulo="Registrar avance" onClose={onClose}>
      <div className="space-y-5">
        <div className="text-sm text-slate-500">{t.actividad}{t.pieza && ` · ${t.pieza}`} · {t.ordenes?.vehiculos?.marca} {t.ordenes?.vehiculos?.modelo} {t.ordenes?.vehiculos?.placas}</div>
        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-brand-200">
          <div className="text-center"><span className="text-5xl font-black text-brand-700">{pct}</span><span className="text-2xl font-bold text-brand-600">%</span></div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={e => setPct(Number(e.target.value))} aria-label="Porcentaje de avance" className="mt-3 w-full accent-brand-600" />
          <div className="mt-3 grid grid-cols-6 gap-1.5">{RAPIDOS.map(n => (
            <button key={n} onClick={() => setPct(n)} className={`rounded-xl py-2.5 text-sm font-bold ${pct === n ? 'bg-brand-700 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{n}</button>
          ))}</div>
          {actual > 0 && <div className="mt-2 text-center text-xs text-slate-500">Avance anterior: {actual}%</div>}
        </div>
        <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Nota (opcional)</span>
          <input className={entrada} value={nota} onChange={e => setNota(e.target.value)} placeholder={termina ? 'Ej. Terminado, listo para pintura' : 'Ej. Enderezado de puerta listo, falta masilla'} /></label>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Foto del avance {termina ? <span className="text-red-600">(obligatoria al terminar)</span> : '(recomendada)'}</span>
          {vista ? (
            <div className="relative overflow-hidden rounded-3xl"><img src={vista} alt="" className="max-h-64 w-full object-cover" />
              <button onClick={() => setFoto(null)} className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Quitar foto"><X className="h-5 w-5" /></button></div>
          ) : (
            <button onClick={() => camara.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/50 py-6 font-bold text-brand-800 active:bg-brand-50"><Camera className="h-9 w-9" /> Tomar foto</button>
          )}
          <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { setFoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </div>
        <button className={botonPrimario} disabled={guardando} onClick={guardar}>
          {guardando ? <><Loader2 className="h-5 w-5 animate-spin" /> Guardando…</> : termina ? <>Terminar trabajo (100%)</> : <>Guardar avance de {pct}%</>}
        </button>
      </div>
    </Hoja>
  )
}
