import { CheckCircle2, History, Trash2 } from 'lucide-react'
import { horaCorta } from '../lib/borrador'

/** Aviso al abrir la recepción: hay una captura sin terminar guardada en este equipo */
export function AvisoBorrador({ guardado, resumen, paso, onContinuar, onDescartar, movil }: {
  guardado: number; resumen: string; paso: number; onContinuar: () => void; onDescartar: () => void; movil?: boolean
}) {
  return (
    <div role="alert" className={`mb-4 border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm ${movil ? 'rounded-3xl' : 'rounded-2xl'}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><History className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Tienes una recepción sin terminar</div>
          <div className="text-sm">{resumen || 'Captura sin datos del vehículo'} · paso {paso} de 4 · guardada {horaCorta(guardado)}</div>
        </div>
      </div>
      <div className={`mt-3 grid gap-2 ${movil ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        <button type="button" onClick={onContinuar} className={`flex items-center justify-center gap-2 bg-amber-500 font-bold text-white shadow active:scale-[.98] ${movil ? 'rounded-2xl py-3.5' : 'rounded-full py-2.5'}`}>
          <History className="h-4 w-4" /> Continuar donde me quedé
        </button>
        <button type="button" onClick={() => { if (confirm('¿Descartar la recepción guardada? Se perderá lo capturado.')) onDescartar() }}
          className={`flex items-center justify-center gap-2 bg-white font-semibold text-amber-800 ring-1 ring-amber-300 active:scale-[.98] ${movil ? 'rounded-2xl py-3' : 'rounded-full py-2.5'}`}>
          <Trash2 className="h-4 w-4" /> Descartar y empezar nueva
        </button>
      </div>
    </div>
  )
}

/** Indicador discreto de que el avance quedó guardado */
export function BorradorGuardado({ ultimo }: { ultimo: number | null }) {
  if (!ultimo) return null
  return <div className="flex items-center justify-center gap-1.5 text-[12px] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Avance guardado en este equipo · {horaCorta(ultimo)}</div>
}

export const resumenBorrador = (f: { siniestro?: string; placas?: string; marca?: string; modelo?: string; cliente_nombre?: string; folio?: string }) =>
  [f.folio && `Folio ${f.folio}`, f.siniestro && `Siniestro ${f.siniestro}`, [f.marca, f.modelo].filter(Boolean).join(' '), f.placas, f.cliente_nombre].filter(Boolean).join(' · ')
