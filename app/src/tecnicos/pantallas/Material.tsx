import { useEffect, useMemo, useState } from 'react'
import { Hammer, Loader2, Minus, Package, Paintbrush, Plus, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorTexto, fechaHora, num } from '../../lib/format'
import { Aviso, Cargando, EncabezadoClaro, Vacio, botonPrimario, entrada } from '../../movil/ui'
import { useMisFichas } from '../datos'

type Seccion = 'hojalateria' | 'pintura'
interface Mat { id: number; descripcion: string; unidad: string; secciones: string[]; orden_lista: number | null }
interface OrdenTec { orden_id: number; actividad_id: number; area: string; folio: string; auto: string; placas: string | null }
interface Sol { id: number; estado: string; cantidad_solicitada: number; cantidad_entregada: number | null; solicitado_at: string; seccion: string | null; materiales: { descripcion: string; unidad: string } | null; ordenes: { folio: string } | null }

const ESTADO: Record<string, [string, string]> = {
  solicitada: ['Solicitado', 'bg-sky-100 text-sky-700'], autorizada: ['Autorizado', 'bg-amber-100 text-amber-700'],
  entregada: ['Entregado', 'bg-emerald-100 text-emerald-700'], rechazada: ['Rechazado', 'bg-red-100 text-red-700'],
}
/** Paso de los botones − / + según la unidad del material */
const paso = (u: string) => (u === 'ml' ? 50 : u === 'lt' ? 0.25 : 1)
const seccionDeArea = (a?: string): Seccion => (a === 'pintura' || a === 'detallado' ? 'pintura' : 'hojalateria')

/** Solicitud de material desde la app de técnicos: unidad → listado de su área → cantidades → enviar al almacén */
export default function Material() {
  const fichas = useMisFichas()
  const [ordenes, setOrdenes] = useState<OrdenTec[] | null>(null)
  const [mats, setMats] = useState<Mat[]>([])
  const [ordenId, setOrdenId] = useState<number | null>(null)
  const [seccion, setSeccion] = useState<Seccion>('hojalateria')
  const [cant, setCant] = useState<Record<number, string>>({})
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null)
  const [mias, setMias] = useState<Sol[]>([])

  useEffect(() => {
    if (!fichas) return
    if (fichas[0]) setSeccion(seccionDeArea(fichas[0].area))
    supabase.from('materiales').select('id,descripcion,unidad,secciones,orden_lista').eq('activo', true).order('orden_lista', { nullsFirst: false }).order('descripcion')
      .then(({ data }) => setMats((data ?? []) as Mat[]))
    if (!fichas.length) { setOrdenes([]); return }
    supabase.from('actividades').select('id,orden_id,area,ordenes(folio,etapa,vehiculos(marca,modelo,placas))').in('tecnico_id', fichas.map(f => f.id)).in('estado', ['asignada', 'en_proceso']).order('fecha_asignacion', { ascending: false })
      .then(({ data }) => {
        type A = { id: number; orden_id: number; area: string; ordenes: { folio: string; etapa: string; vehiculos: { marca: string; modelo: string; placas: string | null } | null } | null }
        const vistos = new Set<number>(); const lista: OrdenTec[] = []
        for (const a of (data ?? []) as unknown as A[]) {
          if (!a.ordenes || ['entregado', 'cancelado'].includes(a.ordenes.etapa) || vistos.has(a.orden_id)) continue
          vistos.add(a.orden_id)
          lista.push({ orden_id: a.orden_id, actividad_id: a.id, area: a.area, folio: a.ordenes.folio, auto: `${a.ordenes.vehiculos?.marca ?? ''} ${a.ordenes.vehiculos?.modelo ?? ''}`.trim(), placas: a.ordenes.vehiculos?.placas ?? null })
        }
        setOrdenes(lista)
        if (lista.length === 1) { setOrdenId(lista[0].orden_id); setSeccion(seccionDeArea(lista[0].area)) }
      })
  }, [fichas])

  // Mis solicitudes recientes (las que hizo este usuario)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('solicitudes_material').select('id,estado,cantidad_solicitada,cantidad_entregada,solicitado_at,seccion,materiales(descripcion,unidad),ordenes(folio)')
        .eq('solicitado_por', data.user.id).order('solicitado_at', { ascending: false }).limit(20).then(({ data: d }) => setMias((d ?? []) as unknown as Sol[]))
    })
  }, [msg])

  const lista = useMemo(() => mats.filter(m => m.secciones?.includes(seccion)), [mats, seccion])
  const elegidos = Object.entries(cant).map(([id, v]) => ({ id: Number(id), q: Number(v) })).filter(x => x.q > 0)
  const orden = ordenes?.find(o => o.orden_id === ordenId)

  function cambiar(m: Mat, delta: number) {
    const actual = Number(cant[m.id] || 0)
    const nuevo = Math.max(0, Math.round((actual + delta) * 1000) / 1000)
    setCant({ ...cant, [m.id]: nuevo ? String(nuevo) : '' })
  }

  async function enviar() {
    setMsg(null)
    if (!orden) return setMsg({ t: 'error', m: 'Elige la unidad (orden) para la que pides el material.' })
    if (!elegidos.length) return setMsg({ t: 'error', m: 'Indica la cantidad de al menos un material.' })
    setEnviando(true)
    const { error } = await supabase.from('solicitudes_material').insert(elegidos.map(x => ({
      orden_id: orden.orden_id, actividad_id: orden.actividad_id, seccion, material_id: x.id, cantidad_solicitada: x.q, notas: nota.trim() || null,
    })))
    setEnviando(false)
    if (error) return setMsg({ t: 'error', m: errorTexto(error) })
    setCant({}); setNota('')
    setMsg({ t: 'ok', m: `Solicitud enviada al almacén: ${elegidos.length} material(es) para ${orden.folio}.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!fichas || !ordenes) return <><EncabezadoClaro titulo="Solicitar material" icono={Package} atras={false} /><Cargando /></>
  return (
    <div>
      <EncabezadoClaro titulo="Solicitar material" sub="Pide al almacén lo que necesitas para tu trabajo" icono={Package} atras={false} />
      <div className="space-y-4 px-4 pb-6">
        {msg && <Aviso tipo={msg.t === 'ok' ? 'ok' : 'error'} onClose={() => setMsg(null)}>{msg.m}</Aviso>}

        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-600">1. ¿Para qué unidad?</h2>
          {ordenes.length === 0 ? <Vacio icono={Package}>No tienes trabajos asignados o en proceso. El material se pide para una unidad en la que estés trabajando.</Vacio> : (
            <div className="space-y-2">
              {ordenes.map(o => (
                <button key={o.orden_id} type="button" onClick={() => { setOrdenId(o.orden_id); setSeccion(seccionDeArea(o.area)) }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${ordenId === o.orden_id ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200'}`}>
                  <span className="text-lg font-extrabold text-slate-900">{o.folio}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{o.auto}{o.placas ? ` · ${o.placas}` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {ordenes.length > 0 && <>
          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-600">2. Materiales de…</h2>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              {([['hojalateria', 'Hojalatería', Hammer], ['pintura', 'Pintura', Paintbrush]] as const).map(([k, l, Ic]) => (
                <button key={k} type="button" onClick={() => setSeccion(k)} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${seccion === k ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}><Ic className="h-4 w-4" /> {l}</button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-600">3. Anota lo que necesitas</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {lista.map(m => {
                const v = cant[m.id] ?? ''
                return (
                  <li key={m.id} className={`flex items-center gap-2 px-3 py-2.5 ${Number(v) > 0 ? 'bg-brand-50/60' : ''}`}>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-800">{m.descripcion}</span>
                    <button type="button" aria-label={`Menos ${m.descripcion}`} onClick={() => cambiar(m, -paso(m.unidad))} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200"><Minus className="h-4 w-4" /></button>
                    <input inputMode="decimal" aria-label={`Cantidad de ${m.descripcion}`} className="w-16 rounded-xl border border-slate-200 px-2 py-1.5 text-center text-base font-bold" value={v} placeholder="0"
                      onChange={e => setCant({ ...cant, [m.id]: e.target.value.replace(/[^0-9.]/g, '') })} />
                    <button type="button" aria-label={`Más ${m.descripcion}`} onClick={() => cambiar(m, paso(m.unidad))} className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white active:bg-brand-700"><Plus className="h-4 w-4" /></button>
                    <span className="w-7 text-xs font-semibold text-slate-500">{m.unidad}</span>
                  </li>
                )
              })}
              {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No hay materiales en este listado. Pide al almacén que los dé de alta.</li>}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-600">4. Nota (opcional)</h2>
            <input className={entrada} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej. color código 1F7, es para la puerta" />
          </section>

          <button className={botonPrimario} disabled={enviando || !orden || !elegidos.length} onClick={enviar}>
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Enviar solicitud{elegidos.length ? ` (${elegidos.length})` : ''}
          </button>
        </>}

        {mias.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-600">Mis solicitudes recientes</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {mias.map(s => {
                const [l, c] = ESTADO[s.estado] ?? [s.estado, 'bg-slate-100']
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{s.materiales?.descripcion} · {num(s.estado === 'entregada' ? s.cantidad_entregada ?? 0 : s.cantidad_solicitada, 3)} {s.materiales?.unidad}</div>
                      <div className="text-xs text-slate-500">{s.ordenes?.folio} · {fechaHora(s.solicitado_at)}</div></div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{l}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
