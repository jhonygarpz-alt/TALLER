import { useMemo, useRef } from 'react'
import { Camera, Check, ImagePlus, X } from 'lucide-react'

export const CASILLAS: Record<string, string[]> = {
  recepcion: ['Frontal', 'Lateral izquierda', 'Lateral derecha', 'Posterior', 'Daños', 'Tablero / Kilometraje'],
  diagnostico: ['Daño principal', 'Detalle del daño', 'Piezas afectadas'],
  dano: ['Daño 1', 'Daño 2', 'Daño 3'],
  proceso: ['Hojalatería', 'Preparación', 'Pintura', 'Armado'],
  entrega: ['Frontal', 'Lateral izquierda', 'Lateral derecha', 'Posterior', 'Interior'],
}

export interface FotosGuiadas { casillas: Record<string, File | null>; extras: File[] }
export const fotosVacias = (cat: string): FotosGuiadas => ({ casillas: Object.fromEntries((CASILLAS[cat] ?? []).map(c => [c, null])), extras: [] })
export const totalFotos = (f: FotosGuiadas) => Object.values(f.casillas).filter(Boolean).length + f.extras.length
/** Lista para subir: [archivo, descripción] */
export const listaFotos = (f: FotosGuiadas): [File, string][] => [
  ...Object.entries(f.casillas).filter(([, v]) => v).map(([k, v]) => [v as File, k] as [File, string]),
  ...f.extras.map(x => [x, ''] as [File, string]),
]

function Vista({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  return <img src={url} alt="" className="h-full w-full object-cover" />
}

/**
 * Rejilla de evidencia fotográfica guiada: una casilla por toma (frontal, laterales, posterior, daños, tablero…)
 * con palomita al tomarla, más "Agregar más fotos". El recuadro superior permite elegir varias a la vez.
 * `guardadas` marca las tomas que ya existen en el expediente.
 */
export function RejillaEvidencia({ valor, onChange, guardadas = {} }: { valor: FotosGuiadas; onChange: (v: FotosGuiadas) => void; guardadas?: Record<string, number> }) {
  const camara = useRef<HTMLInputElement>(null)
  const varias = useRef<HTMLInputElement>(null)
  const destino = useRef<string | null>(null)

  function tomar(casilla: string | null) { destino.current = casilla; camara.current?.click() }
  function recibir(files: FileList | null, unaCasilla: boolean) {
    if (!files?.length) return
    const lista = Array.from(files)
    const v: FotosGuiadas = { casillas: { ...valor.casillas }, extras: [...valor.extras] }
    if (unaCasilla && destino.current) { v.casillas[destino.current] = lista[0]; lista.shift() }
    // las demás llenan las casillas vacías en orden y luego van a "más fotos"
    for (const f of lista) {
      const libre = Object.keys(v.casillas).find(k => !v.casillas[k] && !guardadas[k])
      if (libre) v.casillas[libre] = f; else v.extras.push(f)
    }
    onChange(v)
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => varias.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-3xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center active:bg-slate-50">
        <Camera className="h-9 w-9 text-slate-500" strokeWidth={1.6} />
        <span className="font-bold text-slate-800">Tomar o seleccionar fotografías</span>
        <span className="text-xs text-slate-500">{Object.keys(valor.casillas).join(', ').toLowerCase()}</span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(valor.casillas).map(([casilla, file]) => {
          const hecho = !!file || !!guardadas[casilla]
          return (
            <div key={casilla} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${hecho ? 'ring-brand-300' : 'ring-slate-200'}`}>
              <button type="button" onClick={() => tomar(casilla)} className="relative block aspect-[4/3] w-full bg-slate-100">
                {file ? <Vista file={file} /> : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                    {guardadas[casilla] ? <><Check className="h-7 w-7 text-brand-600" /><span className="text-[11px] font-semibold text-brand-700">Ya guardada</span></> : <><Camera className="h-7 w-7" /><span className="text-[11px] font-semibold">Tomar foto</span></>}
                  </span>
                )}
                {hecho && <span className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-2 ring-white"><Check className="h-4 w-4" strokeWidth={3} /></span>}
              </button>
              <div className="flex items-center justify-between gap-1 px-3 py-2">
                <span className="truncate text-[13px] font-semibold text-slate-700">{casilla}</span>
                {file && <button type="button" onClick={() => onChange({ ...valor, casillas: { ...valor.casillas, [casilla]: null } })} className="shrink-0 rounded-full p-1 text-slate-400" aria-label={`Quitar ${casilla}`}><X className="h-4 w-4" /></button>}
              </div>
            </div>
          )
        })}
        {valor.extras.map((f, i) => (
          <div key={`x${i}`} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-300">
            <div className="relative aspect-[4/3] bg-slate-100"><Vista file={f} /><span className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white"><Check className="h-4 w-4" strokeWidth={3} /></span></div>
            <div className="flex items-center justify-between px-3 py-2"><span className="text-[13px] font-semibold text-slate-700">Adicional {i + 1}</span>
              <button type="button" onClick={() => onChange({ ...valor, extras: valor.extras.filter((_, j) => j !== i) })} className="rounded-full p-1 text-slate-400" aria-label="Quitar foto"><X className="h-4 w-4" /></button></div>
          </div>
        ))}
        <button type="button" onClick={() => varias.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 self-start rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 active:bg-slate-50">
          <ImagePlus className="h-7 w-7" /><span className="text-[13px] font-semibold">Agregar más fotos</span>
        </button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { recibir(e.target.files, true); e.target.value = '' }} />
      <input ref={varias} type="file" accept="image/*" multiple className="hidden" onChange={e => { destino.current = null; recibir(e.target.files, false); e.target.value = '' }} />
    </div>
  )
}
