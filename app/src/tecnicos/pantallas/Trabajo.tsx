import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Camera, CalendarDays, FileText, ImagePlus, Loader2, Play, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { AREAS, ETAPAS, errorTexto, fecha, fechaHora, money2, type Etapa } from '../../lib/format'
import { Miniatura, type FotoRow } from '../../components/Fotos'
import { HojaFotos, VisorFoto } from '../../movil/pantallas/Orden'
import { Aviso, BadgeEtapa, Cargando, botonPrimario, botonSecundario } from '../../movil/ui'
import { BarraAvance, ESTADO_TEC, HojaAvance, ICONO_AREA } from '../componentes'
import { SELECT_TRABAJO, cargarExtras, pctTrabajo, type Avance, type Trabajo } from '../datos'

const NOMBRE_CAT: Record<string, string> = { recepcion: 'Recepción', diagnostico: 'Diagnóstico', dano: 'Daños', proceso: 'Proceso', entrega: 'Entrega', actividad: 'Mis evidencias' }

export default function TrabajoDetalle() {
  const { id } = useParams()
  const nav = useNavigate()
  const [t, setT] = useState<Trabajo | null>(null)
  const [historial, setHistorial] = useState<(Avance & { id: number; perfiles: { nombre: string } | null })[]>([])
  const [ultimo, setUltimo] = useState<Avance | undefined>()
  const [portada, setPortada] = useState<string | null>(null)
  const [fotos, setFotos] = useState<FotoRow[]>([])
  const [hoja, setHoja] = useState<null | 'avance' | 'foto'>(null)
  const [verFoto, setVerFoto] = useState<FotoRow | null>(null)
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('actividades').select(SELECT_TRABAJO).eq('id', id).single()
    if (error) return setMsg({ t: 'error', m: errorTexto(error) })
    const tr = data as unknown as Trabajo
    setT(tr)
    const [ex, h, f] = await Promise.all([
      cargarExtras([tr]),
      supabase.from('actividad_avances').select('id,actividad_id,porcentaje,nota,created_at,perfiles(nombre)').eq('actividad_id', tr.id).order('created_at', { ascending: false }),
      supabase.from('fotos').select('*').eq('orden_id', tr.orden_id).in('categoria', ['recepcion', 'diagnostico', 'dano', 'proceso', 'actividad']).order('created_at', { ascending: false }),
    ])
    setUltimo(ex.avances[tr.id]); setPortada(ex.portadas[tr.orden_id] ?? null)
    setHistorial((h.data ?? []) as unknown as typeof historial)
    setFotos(((f.data ?? []) as FotoRow[]).filter(x => x.categoria !== 'actividad' || x.ref_id === tr.id))
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  if (!t) return <div className="p-4">{msg ? <Aviso>{msg.m}</Aviso> : <Cargando />}</div>
  const v = t.ordenes?.vehiculos
  const Icono = ICONO_AREA[t.area]
  const [lbl, cls] = ESTADO_TEC[t.estado] ?? [t.estado, '']
  const pct = pctTrabajo(t, ultimo)
  const abierta = t.ordenes?.etapa !== 'entregado' && t.ordenes?.etapa !== 'cancelado'

  async function iniciar() {
    setOcupado(true)
    const { error } = await supabase.rpc('actividad_accion', { p_id: t!.id, p_accion: 'iniciar' })
    setOcupado(false)
    if (error) return setMsg({ t: 'error', m: errorTexto(error) })
    setMsg({ t: 'ok', m: 'Trabajo iniciado' }); cargar()
  }

  const grupos = fotos.reduce<Record<string, FotoRow[]>>((g, f) => { (g[f.categoria] ||= []).push(f); return g }, {})
  const tarjeta = 'rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80'
  return (
    <div>
      <div className="relative">
        <Miniatura auto={v ?? undefined} path={portada} className="h-56 w-full rounded-none" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} className="absolute top-[calc(env(safe-area-inset-top)+10px)] left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur" aria-label="Regresar"><ArrowLeft className="h-6 w-6" /></button>
        <div className="absolute inset-x-4 bottom-3 text-white">
          <div className="text-2xl font-extrabold drop-shadow">{v?.marca} {v?.modelo} {v?.anio ?? ''}</div>
          <div className="text-sm opacity-90">{v?.placas ?? 's/placas'}{v?.color && ` · ${v.color}`} · {t.ordenes?.folio}{t.ordenes?.os_bitacora && ` · OS ${t.ordenes.os_bitacora}`}</div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {msg && <Aviso tipo={msg.t === 'ok' ? 'ok' : 'error'} onClose={() => setMsg(null)}>{msg.m}</Aviso>}
        {t.estado === 'en_proceso' && t.rechazos > 0 && t.motivo_rechazo && (
          <div className="flex gap-2 rounded-3xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"><AlertTriangle className="h-5 w-5 shrink-0" /><div><b>Retrabajo solicitado</b> ({t.rechazos}×): {t.motivo_rechazo}</div></div>
        )}

        <div className={tarjeta}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icono className="h-6 w-6" /></span>
              <div><div className="text-[17px] font-extrabold">{t.actividad}</div><div className="text-sm text-slate-500">{t.pieza ?? AREAS[t.area]}</div></div></div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{lbl}</span>
          </div>
          <div className="mt-4"><BarraAvance pct={pct} grande /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-2xl bg-slate-50 p-2"><div className="text-slate-500">Destajo</div><div className="text-sm font-bold">{t.importe_destajo > 0 ? money2(t.importe_destajo) : 'Sin tarifa'}</div></div>
            <div className="rounded-2xl bg-slate-50 p-2"><div className="flex items-center justify-center gap-1 text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Entrega del auto</div><div className="text-sm font-bold">{fecha(t.ordenes?.fecha_compromiso)}</div></div>
          </div>
          {t.ordenes?.etapa && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">Etapa de la orden: <BadgeEtapa etapa={t.ordenes.etapa as Etapa} /></div>}
          {t.fecha_inicio && <div className="mt-1 text-xs text-slate-500">Iniciado {fechaHora(t.fecha_inicio)}{t.fecha_fin && ` · Terminado ${fechaHora(t.fecha_fin)}`}</div>}
        </div>

        {abierta && (
          <div className="space-y-2.5">
            {t.estado === 'asignada' && <button className={botonPrimario} disabled={ocupado} onClick={iniciar}>{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Iniciar trabajo</button>}
            {(t.estado === 'asignada' || t.estado === 'en_proceso') && <button className={t.estado === 'asignada' ? botonSecundario : botonPrimario} onClick={() => setHoja('avance')}><TrendingUp className="h-5 w-5" /> Registrar avance</button>}
            {(t.estado === 'en_proceso' || t.estado === 'terminada') && <button className={botonSecundario} onClick={() => setHoja('foto')}><Camera className="h-5 w-5" /> Agregar foto de evidencia</button>}
          </div>
        )}

        {t.ordenes?.danos_reportados && (
          <div className={tarjeta}>
            <div className="mb-2 flex items-center gap-2 font-bold"><FileText className="h-5 w-5 text-brand-700" /> Daños reportados</div>
            <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 uppercase">{t.ordenes.danos_reportados}</p>
          </div>
        )}

        {historial.length > 0 && (
          <div className={tarjeta}>
            <div className="mb-3 flex items-center gap-2 font-bold"><TrendingUp className="h-5 w-5 text-brand-700" /> Historial de avance</div>
            <ol className="relative ml-2 space-y-3 border-l-2 border-brand-200 pl-5">
              {historial.map(h => (
                <li key={h.id} className="relative"><span className="absolute top-1 -left-[27px] h-3.5 w-3.5 rounded-full bg-brand-600 ring-4 ring-white" />
                  <div className="flex items-center gap-2"><b className="text-brand-700">{h.porcentaje}%</b><span className="text-xs text-slate-500">{fechaHora(h.created_at)}</span></div>
                  {h.nota && <div className="text-sm text-slate-600">{h.nota}</div>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className={tarjeta}>
          <div className="mb-2 flex items-center gap-2 font-bold"><ImagePlus className="h-5 w-5 text-brand-700" /> Fotos de la unidad</div>
          {fotos.length === 0 ? <p className="py-3 text-center text-sm text-slate-400">Sin fotografías todavía</p> :
            Object.entries(grupos).map(([cat, fs]) => (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-xs font-bold text-slate-500">{NOMBRE_CAT[cat] ?? cat} ({fs.length})</div>
                <div className="grid grid-cols-3 gap-2">{fs.map(f => <Miniatura key={f.id} path={f.path} className="aspect-square h-auto w-full rounded-2xl" onClick={() => setVerFoto(f)} />)}</div>
              </div>
            ))}
        </div>
        <p className="px-2 text-center text-xs text-slate-400">Estado de la orden: {t.ordenes?.etapa ? ETAPAS[t.ordenes.etapa as Etapa]?.label : '—'}. Tus avances y fotos se ven al instante en el sistema web.</p>
      </div>

      {hoja === 'avance' && <HojaAvance t={t} actual={pct} onClose={() => setHoja(null)} onListo={m => { setHoja(null); setMsg({ t: 'ok', m }); cargar() }} />}
      {hoja === 'foto' && <HojaFotos ordenId={t.orden_id} refId={t.id} categoriaInicial="actividad" titulo="Foto de evidencia" onClose={() => setHoja(null)} onListo={n => { setHoja(null); setMsg({ t: 'ok', m: `${n} foto(s) guardada(s)` }); cargar() }} />}
      {verFoto && <VisorFoto foto={verFoto} onClose={() => setVerFoto(null)} />}
    </div>
  )
}
