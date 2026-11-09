import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, Loader2, Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Aviso, Cargando } from '../../movil/ui'
import { datos, enviarEncuesta, type OrdenCliente } from '../api'

const ETIQUETAS = ['Mal', 'Regular', 'Bien', 'Muy bien', '¡Excelente!']
const ASPECTOS = ['Atención', 'Calidad del trabajo', 'Tiempo de entrega', 'Limpieza del vehículo', 'Comunicación', 'Trámite con aseguradora']

/** Encuesta de satisfacción: estrellas, aspectos destacados / a mejorar, recomendación y comentario */
export default function Encuesta({ token }: { token: string }) {
  const { id } = useParams()
  const nav = useNavigate()
  const [o, setO] = useState<OrdenCliente | null>(null)
  const [estrellas, setEstrellas] = useState(0)
  const [aspectos, setAspectos] = useState<string[]>([])
  const [recomienda, setRecomienda] = useState<boolean | null>(null)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [gracias, setGracias] = useState(false)

  useEffect(() => { datos(token).then(d => setO(d.ordenes.find(x => String(x.id) === id) ?? null)).catch(e => setError((e as Error).message)) }, [token, id])

  async function enviar() {
    if (!estrellas) return setError('Elige de 1 a 5 estrellas')
    setEnviando(true); setError(null)
    const partes = [
      recomienda != null ? `Recomendaría el taller: ${recomienda ? 'Sí' : 'No'}` : '',
      aspectos.length ? `${estrellas >= 4 ? 'Destacó' : 'A mejorar'}: ${aspectos.join(', ')}` : '',
      comentario.trim(),
    ].filter(Boolean)
    try { await enviarEncuesta(token, Number(id), estrellas, partes.join(' · ')); setGracias(true) } catch (e) { setError((e as Error).message) }
    setEnviando(false)
  }

  if (gracias) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_0_30px_rgba(34,152,175,.5)]"><Heart className="h-10 w-10" fill="currentColor" /></span>
      <h1 className="text-2xl font-extrabold">¡Gracias por tu opinión!</h1>
      <p className="text-slate-600">Nos ayuda a darte un mejor servicio cada vez.</p>
      <button onClick={() => nav('/', { replace: true })} className="mt-2 rounded-2xl bg-brand-700 px-8 py-3.5 font-bold text-white">Volver</button>
    </div>
  )
  if (!o) return <div className="p-6">{error ? <Aviso>{error}</Aviso> : <Cargando />}</div>
  if (o.satisfaccion) return <div className="p-6"><Aviso tipo="ok">Ya calificaste este servicio. ¡Gracias!</Aviso><button className="mt-4 font-semibold text-brand-700" onClick={() => nav('/')}>Volver</button></div>

  const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${on ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200'}`
  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(env(safe-area-inset-bottom)+110px)]">
      <header className="bg-gradient-to-br from-navy-950 to-navy-800 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-6 text-white">
        <button onClick={() => nav(-1)} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Regresar"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="mt-2 text-2xl font-extrabold">¿Cómo te atendimos?</h1>
        <p className="text-sm text-cyan-100/80">Servicio {o.folio} · tu opinión nos ayuda a mejorar</p>
      </header>
      <div className="space-y-5 px-4 pt-5">
        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
        <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200/80">
          <div className="text-sm font-semibold text-slate-600">Calificación general</div>
          <div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setEstrellas(n)} aria-label={`${n} estrellas`} className="transition active:scale-90">
              <Star className={`h-11 w-11 ${n <= estrellas ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,.6)]' : 'text-slate-200'}`} fill="currentColor" />
            </button>
          ))}</div>
          <div className="mt-2 h-6 text-lg font-bold text-amber-500">{estrellas ? ETIQUETAS[estrellas - 1] : ''}</div>
        </div>
        {estrellas > 0 && <>
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            <div className="mb-3 text-sm font-semibold text-slate-600">{estrellas >= 4 ? '¿Qué fue lo mejor?' : '¿Qué podemos mejorar?'}</div>
            <div className="flex flex-wrap gap-2">{ASPECTOS.map(a => <button key={a} onClick={() => setAspectos(x => x.includes(a) ? x.filter(y => y !== a) : [...x, a])} className={chip(aspectos.includes(a))}>{a}</button>)}</div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            <div className="mb-3 text-sm font-semibold text-slate-600">¿Nos recomendarías con familiares o amigos?</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setRecomienda(true)} className={`flex items-center justify-center gap-2 rounded-2xl py-3 font-bold ring-1 ${recomienda === true ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-slate-600 ring-slate-200'}`}><ThumbsUp className="h-5 w-5" /> Sí</button>
              <button onClick={() => setRecomienda(false)} className={`flex items-center justify-center gap-2 rounded-2xl py-3 font-bold ring-1 ${recomienda === false ? 'bg-red-500 text-white ring-red-500' : 'bg-white text-slate-600 ring-slate-200'}`}><ThumbsDown className="h-5 w-5" /> No</button>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            <div className="mb-2 text-sm font-semibold text-slate-600">Comentario (opcional)</div>
            <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} maxLength={600} placeholder="Cuéntanos tu experiencia" className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15" />
          </div>
        </>}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <button disabled={!estrellas || enviando} onClick={enviar} className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-50">
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Enviar calificación
        </button>
      </div>
    </div>
  )
}
