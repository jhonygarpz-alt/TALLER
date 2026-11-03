import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Camera, Check, CheckCircle2, ClipboardList, ExternalLink, FileText, Fuel, History, ImagePlus, Loader2, MessageCircle, MoreVertical, Phone, Play, RotateCcw, Share2, Shield, Smartphone, Truck, User, Users, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { subirFoto, useUrlFirmada, type CategoriaFoto } from '../../lib/storage'
import { ESTADO_ACTIVIDAD, ETAPAS, ETAPAS_TABLERO, errorTexto, fecha, fechaHora, hoyISO, money2, type Etapa } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { ligaInvitacion } from '../../lib/invitacion'
import { CHECKLIST_CALIDAD } from '../../pages/expediente/Entrega'
import { Miniatura, type FotoRow } from '../../components/Fotos'
import { Aviso, BadgeEtapa, Cargando, Campo, Hoja, Vacio, botonPrimario, botonSecundario, entrada } from '../ui'

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
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [o, setO] = useState<VOrden | null>(null)
  const [vin, setVin] = useState<string | null>(null)
  const [fotos, setFotos] = useState<FotoRow[]>([])
  const [acts, setActs] = useState<Act[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(sp.get('ok') === 'fotos' ? `${sp.get('n') ?? ''} foto(s) guardada(s) en el expediente` : null)
  const [hoja, setHoja] = useState<null | 'etapa' | 'entrega' | 'historial' | 'mas'>(null)
  const [verFoto, setVerFoto] = useState<FotoRow | null>(null)
  const [verChecklist, setVerChecklist] = useState(false)
  const [verTodasFotos, setVerTodasFotos] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const trabajosRef = useRef<HTMLElement>(null)

  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('v_ordenes').select('*').eq('id', id).single(),
      supabase.from('fotos').select('*').eq('orden_id', id).order('created_at', { ascending: false }),
      supabase.from('actividades').select('id,actividad,area,estado,importe_destajo,tecnico_id,fecha_inicio,fecha_fin,tecnicos(nombre,perfil_id)').eq('orden_id', id).neq('estado', 'cancelada').order('id'),
    ])
    if (a.error) setError(errorTexto(a.error))
    setO(a.data as VOrden); setFotos((b.data ?? []) as FotoRow[]); setActs((c.data ?? []) as unknown as Act[])
    if (a.data) supabase.from('vehiculos').select('vin').eq('id', (a.data as VOrden).vehiculo_id).single().then(({ data }) => setVin(data?.vin ?? null))
  }, [id])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (sp.get('ok')) setSp(new URLSearchParams(), { replace: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (o && sp.get('tab') === 'trabajos') setTimeout(() => trabajosRef.current?.scrollIntoView({ behavior: 'smooth' }), 300) }, [o, sp])

  if (!o) return <><BarraBlanca titulo="Detalle de OT" /><div className="p-4">{error ? <Aviso>{error}</Aviso> : <Cargando />}</div></>

  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  const idx = FLUJO.indexOf(o.etapa)
  const siguiente = idx >= 0 && idx < FLUJO.length - 1 ? FLUJO[idx + 1] : null
  const retraso = !cerrada && o.fecha_compromiso && o.fecha_compromiso < hoyISO()
  const tel = o.cliente_telefono?.replace(/\D/g, '')
  const check = Object.entries((o.checklist_recepcion ?? {}) as Record<string, string>).filter(([k]) => k !== 'Combustible')
  const combustible = (o.checklist_recepcion as Record<string, string> | null)?.Combustible

  async function cambiarEtapa(etapa: Etapa, just?: string) {
    if (!confirm(`¿Pasar ${o!.folio} a "${ETAPAS[etapa].label}"?`)) return
    setOcupado(true); setError(null); setOk(null)
    const { error } = await supabase.rpc('orden_cambiar_etapa', { p_orden: o!.id, p_etapa: etapa, p_justificacion: just || null })
    setOcupado(false)
    if (error) return setError(errorTexto(error))
    setHoja(null); setOk(`Etapa actualizada: ${ETAPAS[etapa].label}`); cargar()
  }
  async function compartir() {
    const texto = `${o!.folio} · ${o!.marca} ${o!.modelo} ${o!.placas ?? ''} · ${ETAPAS[o!.etapa].label}`
    const url = `${location.origin}${import.meta.env.BASE_URL}ordenes/${o!.id}`
    try {
      if (navigator.share) await navigator.share({ title: o!.folio, text: texto, url })
      else { await navigator.clipboard.writeText(`${texto}\n${url}`); setOk('Liga copiada al portapapeles') }
    } catch { /* cancelado */ }
  }

  const tarjeta = 'rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80'
  const titulo = (Icono: typeof User, t: string, extra?: ReactNode) => <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-slate-900"><Icono className="h-5 w-5 text-brand-700" /><span className="flex-1">{t}</span>{extra}</div>
  const estadoChk: Record<string, [string, string, string]> = { bien: ['Bien', 'text-brand-700', 'bg-brand-600'], danado: ['Dañado', 'text-amber-600', 'bg-amber-500'], no_tiene: ['No tiene', 'text-slate-500', 'bg-slate-400'] }
  const fotosVisibles = verTodasFotos ? fotos : fotos.slice(0, 6)

  return (
    <div>
      <BarraBlanca titulo="Detalle de OT" derecha={<>
        <button onClick={compartir} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100" aria-label="Compartir"><Share2 className="h-5 w-5" /></button>
        <button onClick={() => setHoja('mas')} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:bg-slate-100" aria-label="Más opciones"><MoreVertical className="h-5 w-5" /></button>
      </>} />

      <div className="space-y-3 px-4 pt-3 pb-4">
        <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm ring-1 ring-brand-200/70">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 ring-1 ring-brand-200"><ClipboardList className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><div className="text-[22px] leading-tight font-extrabold text-slate-900">{o.folio}</div><div className="text-xs text-slate-500">Creada: {fecha(o.fecha_ingreso)}{o.os_bitacora && ` · OS ${o.os_bitacora}`}</div></div>
          <BadgeEtapa etapa={o.etapa} />
        </div>

        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}
        {ok && <Aviso tipo="ok" onClose={() => setOk(null)}>{ok}</Aviso>}

        <div className={`${tarjeta} flex gap-3`}>
          <Miniatura auto={o} path={o.foto_portada} className="h-[92px] w-[124px] rounded-2xl" onClick={o.foto_portada ? () => setVerFoto(fotos.find(f => f.path === o.foto_portada) ?? null) : undefined} />
          <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-600">
            <div className="text-base leading-tight font-extrabold text-slate-900">{o.marca} {o.modelo} {o.anio ?? ''}</div>
            <div>Placas: <b className="text-slate-800">{o.placas ?? '—'}</b></div>
            {vin && <div className="truncate">VIN: <b className="text-slate-800">{vin}</b></div>}
            <div>Color: <b className="text-slate-800">{o.color ?? '—'}</b></div>
          </div>
        </div>

        <div className={tarjeta}>
          {titulo(Users, 'Propietario / Aseguradora')}
          <div className="space-y-1.5 text-[14px] text-slate-700">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-slate-400" /><b>{o.tipo === 'aseguradora' ? o.aseguradora_nombre : 'PARTICULAR'}</b>{o.siniestro && <span className="truncate text-xs text-slate-500">· Sin. {o.siniestro}</span>}</div>
            <div className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" />{o.cliente_nombre}</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{o.cliente_telefono ?? 'Sin teléfono'}</div>
          </div>
          {tel && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={`tel:${tel}`} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-200"><Phone className="h-4 w-4" /> Llamar</a>
              <a href={`https://wa.me/52${tel.slice(-10)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 active:bg-emerald-100"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            <div><span className="text-slate-500">Compromiso</span><div className={`text-sm font-bold ${retraso ? 'text-red-600' : ''}`}>{fecha(o.fecha_compromiso)}{retraso && ' · retrasada'}</div></div>
            <div><span className="text-slate-500">Días en la etapa</span><div className="text-sm font-bold">{o.dias_en_etapa ?? 0}</div></div>
          </div>
        </div>

        {o.danos_reportados && (
          <div className={tarjeta}>
            {titulo(FileText, 'Daños reportados')}
            <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 uppercase">{o.danos_reportados}</p>
            {o.objetos && <p className="mt-2 text-xs text-slate-500">Objetos: {o.objetos}</p>}
          </div>
        )}

        {check.length > 0 && (
          <div className={tarjeta}>
            {titulo(CheckCircle2, 'Checklist de condiciones físicas', combustible && <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Fuel className="h-4 w-4" />{combustible}</span>)}
            <div className="flex flex-wrap gap-2">
              {(verChecklist ? check : check.slice(0, 3)).map(([k, v]) => {
                const [l, txt, dot] = estadoChk[v] ?? estadoChk.bien
                return <span key={k} className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs ring-1 ring-slate-200"><span className={`flex h-4 w-4 items-center justify-center rounded-full text-white ${dot}`}><Check className="h-3 w-3" strokeWidth={3} /></span><span className="font-semibold text-slate-700">{k}</span><span className={`font-semibold ${txt}`}>{l}</span></span>
              })}
              {check.length > 3 && <button onClick={() => setVerChecklist(!verChecklist)} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{verChecklist ? 'Ver menos' : `+${check.length - 3} más`}</button>}
            </div>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {!cerrada && o.etapa === 'listo_entrega' && puede('ordenes.gestionar') && <button className={botonPrimario} onClick={() => setHoja('entrega')}><Truck className="h-5 w-5" /> Registrar entrega al cliente</button>}
          {!cerrada && puede('ordenes.etapa') && o.etapa !== 'listo_entrega' && <button className={botonPrimario} disabled={ocupado} onClick={() => setHoja('etapa')}>{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeftRight className="h-5 w-5" />} Actualizar etapa</button>}
          {puede('ordenes.gestionar') && <button className={botonSecundario} onClick={() => nav(`/orden/${o.id}/evidencia?cat=${o.etapa === 'recepcion' || o.etapa === 'diagnostico' ? 'recepcion' : o.etapa === 'listo_entrega' || o.etapa === 'entregado' ? 'entrega' : 'proceso'}`)}><Camera className="h-5 w-5" /> Agregar evidencia</button>}
          <button className={botonSecundario} onClick={() => setHoja('historial')}><History className="h-5 w-5" /> Ver historial</button>
        </div>

        <section ref={trabajosRef} className={tarjeta}>
          {titulo(Wrench, `Trabajos (${acts.length})`)}
          <Trabajos acts={acts} orden={o} onCambio={cargar} miPerfil={perfil?.id} />
        </section>

        <section className={tarjeta}>
          {titulo(ImagePlus, `Fotografías (${fotos.length})`, puede('ordenes.gestionar') && <button onClick={() => nav(`/orden/${o.id}/evidencia`)} className="text-sm font-semibold text-brand-700">Agregar</button>)}
          {fotos.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Aún no hay fotografías</p> : (
            <>
              <div className="grid grid-cols-3 gap-2">{fotosVisibles.map(f => (
                <div key={f.id}><Miniatura path={f.path} className="aspect-square h-auto w-full rounded-2xl" onClick={() => setVerFoto(f)} /><div className="mt-0.5 truncate text-[10px] text-slate-500">{f.descripcion || NOMBRE_CAT[f.categoria]}</div></div>
              ))}</div>
              {fotos.length > 6 && <button onClick={() => setVerTodasFotos(!verTodasFotos)} className="mt-2 w-full py-2 text-sm font-semibold text-brand-700">{verTodasFotos ? 'Ver menos' : `Ver las ${fotos.length} fotos`}</button>}
            </>
          )}
        </section>
      </div>

      {hoja === 'etapa' && <HojaEtapa actual={o.etapa} siguiente={siguiente} onClose={() => setHoja(null)} onElegir={cambiarEtapa} ocupado={ocupado} />}
      {hoja === 'entrega' && <HojaEntrega o={o} onClose={() => setHoja(null)} onListo={() => { setHoja(null); setOk('Vehículo entregado. La orden quedó cerrada.'); cargar() }} />}
      {hoja === 'historial' && <HojaHistorial ordenId={o.id} onClose={() => setHoja(null)} />}
      {hoja === 'mas' && (
        <Hoja titulo="Más opciones" onClose={() => setHoja(null)}>
          <div className="space-y-2 pb-2">
            {!cerrada && puede('ordenes.etapa') && <button className={botonSecundario} onClick={() => setHoja('etapa')}><ArrowLeftRight className="h-5 w-5" /> Cambiar a otra etapa</button>}
            {tel && <a className={botonSecundario} href={`tel:${tel}`}><Phone className="h-5 w-5" /> Llamar al cliente</a>}
            {ligaInvitacion(o) && <a className={botonSecundario} href={ligaInvitacion(o)!} target="_blank" rel="noreferrer"><Smartphone className="h-5 w-5" /> Invitar al cliente a «Mi Auto» (WhatsApp)</a>}
            <a className={botonSecundario} href={`${import.meta.env.BASE_URL}ordenes/${o.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-5 w-5" /> Expediente completo en el sistema web</a>
          </div>
        </Hoja>
      )}
      {verFoto && <VisorFoto foto={verFoto} onClose={() => setVerFoto(null)} />}
    </div>
  )
}

/** Barra superior blanca (detalle) */
function BarraBlanca({ titulo, derecha }: { titulo: string; derecha?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/ordenes'))} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-800 active:bg-slate-100" aria-label="Regresar"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="flex-1 text-[19px] font-extrabold text-slate-900">{titulo}</h1>
        {derecha}
      </div>
    </header>
  )
}

function HojaHistorial({ ordenId, onClose }: { ordenId: number; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: number; fecha: string; etapa_anterior: Etapa | null; etapa_nueva: Etapa; justificacion: string | null; perfiles: { nombre: string } | null }[] | null>(null)
  useEffect(() => {
    supabase.from('orden_historial').select('id,fecha,etapa_anterior,etapa_nueva,justificacion,perfiles(nombre)').eq('orden_id', ordenId).order('fecha', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as typeof rows))
  }, [ordenId])
  return (
    <Hoja titulo="Historial de la orden" onClose={onClose}>
      {!rows ? <Cargando /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Sin movimientos</p> : (
        <ol className="relative ml-2 space-y-4 border-l-2 border-brand-200 pb-2 pl-5">
          {rows.map(h => (
            <li key={h.id} className="relative">
              <span className="absolute top-1 -left-[27px] h-3.5 w-3.5 rounded-full bg-brand-600 ring-4 ring-white" />
              <div className="flex flex-wrap items-center gap-1.5"><BadgeEtapa etapa={h.etapa_nueva} />{h.etapa_anterior && <span className="text-xs text-slate-400">desde {ETAPAS[h.etapa_anterior].label}</span>}</div>
              <div className="mt-1 text-xs text-slate-500">{fechaHora(h.fecha)}{h.perfiles?.nombre && ` · ${h.perfiles.nombre}`}</div>
              {h.justificacion && <div className="mt-0.5 text-sm text-slate-600">{h.justificacion}</div>}
            </li>
          ))}
        </ol>
      )}
    </Hoja>
  )
}

function HojaEtapa({ actual, siguiente, onClose, onElegir, ocupado }: { actual: Etapa; siguiente?: Etapa | null; onClose: () => void; onElegir: (e: Etapa, j?: string) => void; ocupado: boolean }) {
  const [just, setJust] = useState('')
  return (
    <Hoja titulo="Actualizar etapa" onClose={onClose}>
      <div className="space-y-2">
        {siguiente && <button disabled={ocupado} onClick={() => onElegir(siguiente, just)} className={`${botonPrimario} mb-2`}><ArrowRight className="h-5 w-5" /> Siguiente: {ETAPAS[siguiente].label}</button>}
        <div className="px-1 pt-1 text-xs font-semibold text-slate-500">O elige otra etapa</div>
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

export function HojaFotos({ ordenId, onClose, onListo, categoriaInicial = 'proceso', refId, titulo }: { ordenId: number; onClose: () => void; onListo: (n: number) => void; categoriaInicial?: CategoriaFoto; refId?: number; titulo?: string }) {
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

export function VisorFoto({ foto, onClose }: { foto: FotoRow; onClose: () => void }) {
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
