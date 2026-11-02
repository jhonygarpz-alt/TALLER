import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Car, FileText, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { subirFoto, useUrlFirmada, type CategoriaFoto } from '../lib/storage'
import { errorTexto, fechaHora } from '../lib/format'
import { Modal } from './ui'

export interface FotoRow { id: number; path: string; categoria: string; ref_id: number | null; descripcion: string | null; created_at: string }

export function Miniatura({ path, className = 'h-12 w-16', onClick }: { path?: string | null; className?: string; onClick?: () => void }) {
  const url = useUrlFirmada(path)
  const esPdf = path?.endsWith('.pdf')
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 ${className}`}>
      {esPdf ? <FileText className="h-1/2 w-1/2" /> : url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Car className="h-1/2 w-1/2" strokeWidth={1.5} />}
    </button>
  )
}

function Visor({ foto, onClose }: { foto: FotoRow; onClose: () => void }) {
  const url = useUrlFirmada(foto.path)
  return (
    <Modal title={foto.descripcion || 'Fotografía'} onClose={onClose} wide>
      {url && (foto.path.endsWith('.pdf')
        ? <a className="btn-primary btn" href={url} target="_blank" rel="noreferrer">Abrir documento</a>
        : <img src={url} alt="" className="mx-auto max-h-[70vh] rounded-lg" />)}
      <p className="mt-2 text-xs text-slate-500">Subida {fechaHora(foto.created_at)}</p>
    </Modal>
  )
}

/** Galería de fotos de una orden (filtrada por categoría y referencia) con carga desde cámara o archivo */
export function Galeria({ ordenId, categoria, refId, puedeSubir = true, titulo, onCambio, compacta }: {
  ordenId: number; categoria: CategoriaFoto; refId?: number | null; puedeSubir?: boolean; titulo?: string; onCambio?: () => void; compacta?: boolean
}) {
  const [fotos, setFotos] = useState<FotoRow[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ver, setVer] = useState<FotoRow | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    let q = supabase.from('fotos').select('*').eq('orden_id', ordenId).eq('categoria', categoria).order('id')
    q = refId == null ? q.is('ref_id', null) : q.eq('ref_id', refId)
    const { data } = await q
    setFotos((data ?? []) as FotoRow[])
  }, [ordenId, categoria, refId])
  useEffect(() => { cargar() }, [cargar])

  async function subir(files: FileList | null) {
    if (!files?.length) return
    setSubiendo(true); setError(null)
    try {
      for (const f of Array.from(files)) await subirFoto(f, ordenId, categoria, refId)
      await cargar(); onCambio?.()
    } catch (e) { setError(errorTexto(e)) }
    setSubiendo(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      {titulo && <div className="mb-2 text-sm font-semibold text-slate-700">{titulo}</div>}
      <div className="flex flex-wrap gap-2">
        {fotos.map(f => <Miniatura key={f.id} path={f.path} className={compacta ? 'h-14 w-14' : 'h-24 w-32'} onClick={() => setVer(f)} />)}
        {puedeSubir && (
          <button type="button" onClick={() => input.current?.click()} disabled={subiendo}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 ${compacta ? 'h-14 w-14' : 'h-24 w-32'}`}>
            {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {!compacta && (subiendo ? 'Subiendo…' : 'Agregar foto')}
          </button>
        )}
        {!puedeSubir && fotos.length === 0 && <span className="text-xs text-slate-400">Sin fotografías</span>}
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" multiple hidden onChange={e => subir(e.target.files)} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {ver && <Visor foto={ver} onClose={() => setVer(null)} />}
    </div>
  )
}
