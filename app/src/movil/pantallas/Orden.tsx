import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Calendar, Camera, CheckCircle2, ChevronDown, Clock, ExternalLink, Gauge, ImagePlus, Loader2, MessageCircle, Phone, Play, RotateCcw, Shield, Truck, User, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { subirFoto, useUrlFirmada, type CategoriaFoto } from '../../lib/storage'
import { ESTADO_ACTIVIDAD, ETAPAS, ETAPAS_TABLERO, errorTexto, fecha, fechaHora, hoyISO, money2, type Etapa } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { CHECKLIST_CALIDAD } from '../../pages/expediente/Entrega'
import { Miniatura, type FotoRow } from '../../components/Fotos'
import { Aviso, Barra, BadgeEtapa, Cargando, Campo, Hoja, Vacio, botonPrimario, botonSecundario, entrada } from '../ui'

const FLUJO: Etapa[] = ETAPAS_TABLERO.filter(e => e !== 'entregado')
const CATEGORIAS: { id: CategoriaFoto; label: string }[] = [
  { id: 'recepcion', label: 'Recepción' }, { id: 'diagnostico', label: 'Diagnóstico' }, { id: 'dano', label: 'Daños' },
  { id: 'proceso', label: 'Proceso' }, { id: 'entrega', label: 'Entrega' },
]
const NOMBRE_CAT: Record<string, string> = { recepcion: 'Recepción', diagnostico: 'Diagnóstico', dano: 'Daños', proceso: 'Proceso', entrega: 'Entrega', actividad: 'Trabajos', conformidad: 'Conformidad', pieza_retirada: 'Piezas retiradas', factura: 'Facturas' }

interface Act { id: number; actividad: string; area: string; estado: string; importe_destajo: number; tecnico_id: number; fecha_inicio: string | null; fecha_fin: string | null; tecnicos?: { nombre: string; perfil_id: string | null } | null }

export default function Orden() {
  const { id } = useParams()
  const { puede, perfil } = useAuth()
  const [o, setO] = useState<VOrden | null>(null)
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<'datos' | 'fotos' | 'trabajos'>(sp.get('tab') === 'trabajos' ? 'trabajos' : 'datos')
  const [fotos, setFotos] = useState<FotoRow[]>([])
  const [acts, setActs] = useState<Act[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [hoja, setHoja] = useState<null | 'etapa' | 'entrega' | 'foto'>(null)
  const [verFoto, setVerFoto] = useState<FotoRow | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('v_ordenes').select('*').eq('id', id).single(),
      supabase.from('fotos').select('*').eq('orden_id', id).order('created_at', { ascending: false }),
      supabase.from('actividades').select('id,actividad,area,estado,importe_destajo,tecnico_id,fecha_inicio,fecha_fin,tecnicos(nombre,perfil_id)').eq('orden_id', id).neq('estado', 'cancelada').order('id'),
    ])
    if (a.error) setError(errorTexto(a.error))
    setO(a.data as VOrden); setFotos((b.data ?? []) as FotoRow[]); setActs((c.data ?? []) as unknown as Act[])
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  if (!o) return <><Barra titulo="Orden" atras /><div className="p-4">{error ? <Aviso>{error}</Aviso> : <Cargando />}</div></>

  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  const idx = FLUJO.indexOf(o.etapa)
  const siguiente = idx >= 0 && idx < FLUJO.length - 1 ? FLUJO[idx + 1] : null
  const retraso = !cerrada && o.fecha_compromiso && o.fecha_compromiso < hoyISO()

  async function cambiarEtapa(etapa: Etapa, just?: string) {
    if (!confirm(`¿Pasar ${o!.folio} a "${ETAPAS[etapa].label}"?`)) return
    setOcupado(true); setError(null); setOk(null)
    const { error } = await supabase.rpc('orden_cambiar_etapa', { p_orden: o!.id, p_etapa: etapa, p_justificacion: just || null })
    setOcupado(false)
    if (error) return setError(errorTexto(error))
    setHoja(null); setOk(`Etapa actualizada: ${ETAPAS[etapa].label}`); cargar()
  }

  const tel = o.cliente_telefono?.replace(/\D/g, '')
  const tabBtn = (t: typeof tab, label: string, n?: number) => (
    <button onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${tab === t ? 'bg-white text-brand-800 shadow' : 'text-slate-500'}`}>{label}{n ? <span className="ml-1 text-xs font-semibold text-slate-400">{n}</span> : null}</button>
  )

  return (
    <div>
      <Barra titulo={o.folio} sub={`${o.marca} ${o.modelo} · ${o.placas ?? 's/placas'}`} atras="/ordenes" />
      <div className="relative">
        <Miniatura auto={o} path={o.foto_portada} className="h-52 w-full rounded-none" onClick={o.foto_portada ? () => setTab('fotos') : undefined} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2"><BadgeEtapa etapa={o.etapa} grande />{retraso && <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">Retrasada</span>}</div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-extrabold text-slate-900">{o.marca} {o.modelo} {o.anio ?? ''}</div>
              <div className="text-sm text-slate-500">{o.placas ?? 's/placas'}{o.color && ` · ${o.color}`}{o.os_bitacora && ` · OS ${o.os_bitacora}`}</div>
            </div>
            <span className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold ${o.tipo === 'aseguradora' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>{o.tipo === 'aseguradora' ? o.aseguradora_nombre : 'Particular'}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 p-2"><div className="text-[11px] text-slate-500">Ingreso</div><div className="text-sm font-bold">{fecha(o.fecha_ingreso)}</div></div>
            <div className={`rounded-2xl p-2 ${retraso ? 'bg-red-50' : 'bg-slate-50'}`}><div className="text-[11px] text-slate-500">Compromiso</div><div className={`text-sm font-bold ${retraso ? 'text-red-600' : ''}`}>{fecha(o.fecha_compromiso)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-2"><div className="text-[11px] text-slate-500">En etapa</div><div className="text-sm font-bold">{o.dias_en_etapa ?? 0} días</div></div>
          </div>
        </div>

        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
        {ok && <Aviso tipo="ok" onClose={() => setOk(null)}>{ok}</Aviso>}

        {!cerrada && puede('ordenes.etapa') && (
          <div className="space-y-2">
            {o.etapa === 'listo_entrega' ? (
              puede('ordenes.gestionar') && <button className={botonPrimario} onClick={() => setHoja('entrega')}><Truck className="h-5 w-5" /> Registrar entrega al cliente</button>
            ) : siguiente && (
              <button className={botonPrimario} disabled={ocupado} onClick={() => cambiarEtapa(siguiente)}>
                {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} Pasar a {ETAPAS[siguiente].label}
              </button>
            )}
            <button className={botonSecundario} onClick={() => setHoja('etapa')}><ChevronDown className="h-5 w-5" /> Elegir otra etapa</button>
          </div>
        )}

        <div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1">
          {tabBtn('datos', 'Datos')}{tabBtn('fotos', 'Fotos', fotos.length)}{tabBtn('trabajos', 'Trabajos', acts.length)}
        </div>

        {tab === 'datos' && (
          <div className="space-y-3">
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><User className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><div className="text-xs text-slate-500">Cliente</div><div className="truncate font-bold">{o.cliente_nombre}</div><div className="text-sm text-slate-500">{o.cliente_telefono ?? 'Sin teléfono'}</div></div>
              </div>
              {tel && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700 active:bg-slate-200"><Phone className="h-5 w-5" /> Llamar</a>
                  <a href={`https://wa.me/52${tel.slice(-10)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 font-semibold text-emerald-700 active:bg-emerald-100"><MessageCircle className="h-5 w-5" /> WhatsApp</a>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100 rounded-3xl bg-white px-4 shadow-sm ring-1 ring-slate-200/80">
              {([
                [Shield, 'Siniestro', o.siniestro],
                [Wrench, 'Tipo de reparación', o.tipo_reparacion_nombre],
                [User, 'Asesor', o.asesor_nombre],
                [Gauge, 'Kilometraje', o.kilometraje != null ? `${o.kilometraje.toLocaleString('es-MX')} km` : null],
                [Calendar, 'Entregado', o.fecha_entrega ? fechaHora(o.fecha_entrega) : null],
                [Clock, 'Técnicos trabajando', o.tecnicos_activos],
              ] as [typeof User, string, string | null | undefined][]).filter(([, , v]) => v).map(([Icono, l, v]) => (
                <div key={l} className="flex items-center gap-3 py-3"><Icono className="h-5 w-5 text-slate-400" /><span className="flex-1 text-sm text-slate-500">{l}</span><span className="text-right text-sm font-semibold">{v}</span></div>
              ))}
            </div>
            {o.danos_reportados && <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80"><div className="mb-1 text-xs font-semibold text-slate-500">Daños reportados</div><p className="text-sm whitespace-pre-line">{o.danos_reportados}</p></div>}
            {o.objetos && <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80"><div className="mb-1 text-xs font-semibold text-slate-500">Objetos y accesorios</div><p className="text-sm">{o.objetos}</p></div>}
            <a href={`${import.meta.env.BASE_URL}ordenes/${o.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-brand-700"><ExternalLink className="h-4 w-4" /> Ver expediente completo en el sistema web</a>
          </div>
        )}

        {tab === 'fotos' && (
          <div className="space-y-4">
            {puede('ordenes.gestionar') && <button className={botonPrimario} onClick={() => setHoja('foto')}><Camera className="h-5 w-5" /> Tomar o subir fotos</button>}
            {fotos.length === 0 ? <Vacio icono={ImagePlus}>Aún no hay fotografías de esta orden</Vacio> :
              Object.entries(fotos.reduce<Record<string, FotoRow[]>>((g, f) => { (g[f.categoria] ||= []).push(f); return g }, {})).map(([cat, fs]) => (
                <section key={cat}>
                  <h3 className="mb-2 px-1 text-sm font-bold text-slate-600">{NOMBRE_CAT[cat] ?? cat} <span className="font-normal text-slate-400">({fs.length})</span></h3>
                  <div className="grid grid-cols-3 gap-2">{fs.map(f => <Miniatura key={f.id} path={f.path} className="aspect-square h-auto w-full rounded-2xl" onClick={() => setVerFoto(f)} />)}</div>
                </section>
              ))}
          </div>
        )}

        {tab === 'trabajos' && <Trabajos acts={acts} orden={o} onCambio={cargar} miPerfil={perfil?.id} />}
      </div>

      {hoja === 'etapa' && (
        <HojaEtapa actual={o.etapa} onClose={() => setHoja(null)} onElegir={cambiarEtapa} ocupado={ocupado} />
      )}
      {hoja === 'entrega' && <HojaEntrega o={o} onClose={() => setHoja(null)} onListo={() => { setHoja(null); setOk('Vehículo entregado. La orden quedó cerrada.'); cargar() }} />}
      {hoja === 'foto' && <HojaFotos ordenId={o.id} onClose={() => setHoja(null)} onListo={n => { setHoja(null); setOk(`${n} foto(s) guardada(s)`); setTab('fotos'); cargar() }} />}
      {verFoto && <VisorFoto foto={verFoto} onClose={() => setVerFoto(null)} />}
    </div>
  )
}

function HojaEtapa({ actual, onClose, onElegir, ocupado }: { actual: Etapa; onClose: () => void; onElegir: (e: Etapa, j?: string) => void; ocupado: boolean }) {
  const [just, setJust] = useState('')
  return (
    <Hoja titulo="Cambiar etapa" onClose={onClose}>
      <div className="space-y-2">
        {FLUJO.map(e => (
          <button key={e} disabled={e === actual || ocupado} onClick={() => onElegir(e, just)}
            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left font-semibold ring-1 ${e === actual ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white ring-slate-200 active:bg-slate-50'}`}>
            {ETAPAS[e].label}{e === actual && <span className="text-xs font-bold">Actual</span>}
          </button>
        ))}
        <Campo label="Justificación (si regresas o saltas etapas)"><input className={entrada} value={just} onChange={e => setJust(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
    </Hoja>
  )
}

function HojaEntrega({ o, onClose, onListo }: { o: VOrden; onClose: () => void; onListo: () => void }) {
  const [recibe, setRecibe] = useState(o.cliente_nombre ?? '')
  const [check, setCheck] = useState<Record<string, boolean>>(Object.fromEntries(CHECKLIST_CALIDAD.map(c => [c, false])))
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const completo = Object.values(check).every(Boolean)
  async function entregar() {
    if (!recibe.trim()) return setError('Indica quién recibe el vehículo')
    if (!completo && !confirm('El checklist de calidad no está completo. ¿Entregar de todas formas?')) return
    if (!confirm(`¿Confirmas la entrega de ${o.folio} a ${recibe}? La orden quedará cerrada.`)) return
    setEnviando(true); setError(null)
    const { error } = await supabase.rpc('orden_entregar', { p_orden: o.id, p_recibe: recibe.trim(), p_checklist: check, p_justificacion: completo ? null : 'Entregado con checklist incompleto (app móvil)' })
    setEnviando(false)
    if (error) return setError(errorTexto(error))
    onListo()
  }
  return (
    <Hoja titulo="Entrega del vehículo" onClose={onClose}>
      <div className="space-y-4">
        {error && <Aviso>{error}</Aviso>}
        <Campo label="Nombre de quien recibe"><input className={entrada} value={recibe} onChange={e => setRecibe(e.target.value)} /></Campo>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold text-slate-600">Checklist de calidad</span>
            <button className="text-sm font-semibold text-brand-700" onClick={() => setCheck(Object.fromEntries(CHECKLIST_CALIDAD.map(c => [c, true])))}>Marcar todo</button></div>
          <div className="space-y-2">{CHECKLIST_CALIDAD.map(c => (
            <label key={c} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${check[c] ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200'}`}>
              <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={check[c]} onChange={e => setCheck({ ...check, [c]: e.target.checked })} /><span className="text-sm font-medium">{c}</span>
            </label>
          ))}</div>
        </div>
        <button className={botonPrimario} disabled={enviando} onClick={entregar}>{enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Confirmar entrega</button>
      </div>
    </Hoja>
  )
}

function HojaFotos({ ordenId, onClose, onListo, categoriaInicial = 'proceso', refId, titulo }: { ordenId: number; onClose: () => void; onListo: (n: number) => void; categoriaInicial?: CategoriaFoto; refId?: number; titulo?: string }) {
  const [cat, setCat] = useState<CategoriaFoto>(categoriaInicial)
  const [archivos, setArchivos] = useState<File[]>([])
  const [desc, setDesc] = useState('')
  const [progreso, setProgreso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const agregar = (fl: FileList | null) => fl && setArchivos(a => [...a, ...Array.from(fl)])
  async function guardar() {
    setError(null); let n = 0
    for (const [i, f] of archivos.entries()) {
      setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`)
      try { await subirFoto(f, ordenId, cat, refId ?? null, desc); n++ } catch (e) { setError(`No se pudo subir ${f.name}: ${errorTexto(e)}`) }
    }
    setProgreso(null)
    if (n) onListo(n)
  }
  return (
    <Hoja titulo={titulo ?? (refId ? 'Evidencia del trabajo' : 'Fotografías')} onClose={onClose}>
      <div className="space-y-4">
        {error && <Aviso>{error}</Aviso>}
        {!refId && (
          <div className="flex flex-wrap gap-2">{CATEGORIAS.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${cat === c.id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{c.label}</button>
          ))}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => camara.current?.click()} className="flex flex-col items-center gap-2 rounded-3xl bg-brand-50 py-6 font-bold text-brand-800 ring-2 ring-brand-200 active:scale-[.98]"><Camera className="h-8 w-8" /> Cámara</button>
          <button onClick={() => galeria.current?.click()} className="flex flex-col items-center gap-2 rounded-3xl bg-slate-50 py-6 font-bold text-slate-700 ring-1 ring-slate-200 active:scale-[.98]"><ImagePlus className="h-8 w-8" /> Galería</button>
        </div>
        <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { agregar(e.target.files); e.target.value = '' }} />
        <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={e => { agregar(e.target.files); e.target.value = '' }} />
        {archivos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">{archivos.map((f, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              <button onClick={() => setArchivos(a => a.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 text-xs font-bold text-white" aria-label="Quitar">✕</button>
            </div>
          ))}</div>
        )}
        <Campo label="Descripción (opcional)"><input className={entrada} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej. Defensa delantera lado derecho" /></Campo>
        <button className={botonPrimario} disabled={!archivos.length || !!progreso} onClick={guardar}>
          {progreso ? <><Loader2 className="h-5 w-5 animate-spin" /> {progreso}</> : titulo?.startsWith('Terminar') ? <>Guardar y terminar trabajo</> : <>Guardar {archivos.length || ''} foto(s)</>}
        </button>
      </div>
    </Hoja>
  )
}

function VisorFoto({ foto, onClose }: { foto: FotoRow; onClose: () => void }) {
  const url = useUrlFirmada(foto.path)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={onClose}>
      <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)] text-white"><span className="text-sm">{foto.descripcion || NOMBRE_CAT[foto.categoria]}</span><span className="text-xs text-white/60">{fechaHora(foto.created_at)}</span></div>
      <div className="flex flex-1 items-center justify-center">{url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <Loader2 className="h-8 w-8 animate-spin text-white" />}</div>
      <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] text-center text-sm text-white/70">Toca para cerrar</div>
    </div>
  )
}

/** Trabajos de la orden con acciones según el rol */
export function Trabajos({ acts, orden, onCambio, miPerfil }: { acts: Act[]; orden: VOrden; onCambio: () => void; miPerfil?: string }) {
  const { puede } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [evidencia, setEvidencia] = useState<{ a: Act; terminar: boolean } | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  async function accion(a: Act, acc: string) {
    const horas: number | null = null; let motivo: string | null = null
    if (acc === 'rechazar') { motivo = prompt('¿Qué hay que corregir? (retrabajo)'); if (!motivo) return }
    if (acc === 'validar' && !confirm(`¿Validar "${a.actividad}"? Se generará el destajo de ${money2(a.importe_destajo)}.`)) return
    setOcupado(a.id); setError(null)
    const { error } = await supabase.rpc('actividad_accion', { p_id: a.id, p_accion: acc, p_horas: horas, p_motivo: motivo })
    setOcupado(null)
    if (error) return setError(errorTexto(error))
    onCambio()
  }
  if (!acts.length) return <Vacio icono={Wrench}>No hay trabajos asignados en esta orden. Se asignan desde el sistema web (Trabajos y avance).</Vacio>
  return (
    <div className="space-y-3">
      {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
      {acts.map(a => {
        const mio = !!miPerfil && a.tecnicos?.perfil_id === miPerfil
        const puedeAvanzar = mio || puede('actividades.asignar')
        const est = ESTADO_ACTIVIDAD[a.estado]
        return (
          <div key={a.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-bold">{a.actividad}</div><div className="text-sm text-slate-500">{a.tecnicos?.nombre}{mio && ' (tú)'}</div></div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${est?.badge ?? 'bg-slate-100'}`}>{est?.label ?? a.estado}</span>
            </div>
            {orden.etapa !== 'entregado' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {a.estado === 'asignada' && puedeAvanzar && <button disabled={ocupado === a.id} onClick={() => accion(a, 'iniciar')} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 font-bold text-white active:scale-[.98]"><Play className="h-5 w-5" /> Iniciar trabajo</button>}
                {a.estado === 'en_proceso' && puedeAvanzar && <button disabled={ocupado === a.id} onClick={() => setEvidencia({ a, terminar: true })} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3 font-bold text-white active:scale-[.98]"><Camera className="h-5 w-5" /> Terminar con foto de evidencia</button>}
                {a.estado === 'terminada' && puede('actividades.validar') && <>
                  <button disabled={ocupado === a.id} onClick={() => accion(a, 'validar')} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-bold text-white"><CheckCircle2 className="h-5 w-5" /> Validar</button>
                  <button disabled={ocupado === a.id} onClick={() => accion(a, 'rechazar')} className="flex items-center justify-center gap-2 rounded-2xl bg-amber-100 py-3 font-bold text-amber-800"><RotateCcw className="h-5 w-5" /> Retrabajo</button>
                </>}
                {a.estado === 'terminada' && (mio || puede('ordenes.gestionar')) &&
                  <button onClick={() => setEvidencia({ a, terminar: false })} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700"><Camera className="h-5 w-5" /> Foto de evidencia</button>}
              </div>
            )}
          </div>
        )
      })}
      {evidencia && <HojaFotos ordenId={orden.id} refId={evidencia.a.id} categoriaInicial="actividad" titulo={evidencia.terminar ? 'Terminar: foto de evidencia' : undefined}
        onClose={() => setEvidencia(null)} onListo={() => { const e = evidencia; setEvidencia(null); if (e.terminar) accion(e.a, 'terminar'); else onCambio() }} />}
    </div>
  )
}
