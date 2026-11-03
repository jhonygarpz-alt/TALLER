import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Camera, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { subirFoto, type CategoriaFoto } from '../../lib/storage'
import { errorTexto } from '../../lib/format'
import { Miniatura, type FotoRow } from '../../components/Fotos'
import { CASILLAS, RejillaEvidencia, fotosVacias, listaFotos, totalFotos, type FotosGuiadas } from '../Evidencia'
import { Aviso, EncabezadoClaro } from '../ui'

const CATS: { id: CategoriaFoto; label: string; sub: string }[] = [
  { id: 'recepcion', label: 'Recepción', sub: 'Registra fotografías de recepción' },
  { id: 'diagnostico', label: 'Diagnóstico', sub: 'Daños encontrados al desarmar' },
  { id: 'dano', label: 'Daños', sub: 'Detalle de cada daño' },
  { id: 'proceso', label: 'Proceso', sub: 'Avance de la reparación' },
  { id: 'entrega', label: 'Entrega', sub: 'Cómo se entrega el vehículo' },
]

export default function EvidenciaFotos() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [cat, setCat] = useState<CategoriaFoto>((sp.get('cat') as CategoriaFoto) || 'recepcion')
  const [folio, setFolio] = useState('')
  const [existentes, setExistentes] = useState<FotoRow[]>([])
  const [fotos, setFotos] = useState<FotosGuiadas>(fotosVacias(cat))
  const [progreso, setProgreso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { supabase.from('ordenes').select('folio').eq('id', id).single().then(({ data }) => setFolio(data?.folio ?? '')) }, [id])
  useEffect(() => {
    setFotos(fotosVacias(cat))
    supabase.from('fotos').select('*').eq('orden_id', id).eq('categoria', cat).order('created_at').then(({ data }) => setExistentes((data ?? []) as FotoRow[]))
  }, [id, cat])

  const guardadas = useMemo(() => existentes.reduce<Record<string, number>>((g, f) => { if (f.descripcion && CASILLAS[cat]?.includes(f.descripcion)) g[f.descripcion] = (g[f.descripcion] ?? 0) + 1; return g }, {}), [existentes, cat])
  const info = CATS.find(c => c.id === cat)!
  const n = totalFotos(fotos)

  async function guardar() {
    const lista = listaFotos(fotos)
    setError(null); let ok = 0
    for (const [i, [file, desc]] of lista.entries()) {
      setProgreso(`Subiendo ${i + 1} de ${lista.length}…`)
      try { await subirFoto(file, Number(id), cat, null, desc) ; ok++ } catch (e) { setError(`Una foto no se pudo subir: ${errorTexto(e)}`) }
    }
    setProgreso(null)
    if (ok === lista.length) nav(`/orden/${id}?ok=fotos&n=${ok}`, { replace: true })
    else if (ok) { setFotos(fotosVacias(cat)); supabase.from('fotos').select('*').eq('orden_id', id).eq('categoria', cat).then(({ data }) => setExistentes((data ?? []) as FotoRow[])) }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(110px+env(safe-area-inset-bottom))]">
      <EncabezadoClaro titulo="Evidencia fotográfica" sub={`${info.sub}${folio ? ` · ${folio}` : ''}`} icono={Camera}
        atras={() => (n && !confirm('Tienes fotos sin guardar. ¿Salir sin guardarlas?') ? null : nav(-1))}>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {CATS.map(c => (
            <button key={c.id} onClick={() => (n && !confirm('Cambiar de categoría descarta las fotos sin guardar. ¿Continuar?') ? null : setCat(c.id))}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-[13px] font-semibold ${cat === c.id ? 'bg-brand-700 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{c.label}</button>
          ))}
        </div>
      </EncabezadoClaro>

      <div className="space-y-4 px-4 pt-2">
        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
        <RejillaEvidencia valor={fotos} onChange={setFotos} guardadas={guardadas} />
        {existentes.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-bold text-slate-600"><Check className="h-4 w-4 text-brand-600" /> Ya guardadas en el expediente ({existentes.length})</h3>
            <div className="grid grid-cols-4 gap-2">{existentes.map(f => <Miniatura key={f.id} path={f.path} className="aspect-square h-auto w-full rounded-xl" />)}</div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <button disabled={!n || !!progreso} onClick={guardar} className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-[17px] font-bold text-white shadow-lg shadow-brand-900/25 disabled:opacity-50">
          {progreso ? <><Loader2 className="h-5 w-5 animate-spin" /> {progreso}</> : <><Check className="h-5 w-5" strokeWidth={3} /> Guardar evidencia{n ? ` (${n})` : ''}</>}
        </button>
      </div>
    </div>
  )
}
