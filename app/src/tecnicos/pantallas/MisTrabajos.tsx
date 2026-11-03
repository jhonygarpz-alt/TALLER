import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, Hammer, Paintbrush, PlayCircle, RefreshCw, Timer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useEmpresa } from '../../lib/empresa'
import { errorTexto } from '../../lib/format'
import { Aviso, Cargando, Vacio } from '../../movil/ui'
import { HojaAvance, TarjetaTrabajo } from '../componentes'
import { BannerNotificaciones } from '../Notificaciones'
import { SELECT_TRABAJO, cargarExtras, pctTrabajo, useMisFichas, type Avance, type Trabajo } from '../datos'

type Vista = 'hacer' | 'proceso' | 'terminados'

export default function MisTrabajos() {
  const { perfil } = useAuth()
  const emp = useEmpresa()
  const fichas = useMisFichas()
  const [vista, setVista] = useState<Vista>('proceso')
  const [rows, setRows] = useState<Trabajo[] | null>(null)
  const [avances, setAvances] = useState<Record<number, Avance>>({})
  const [portadas, setPortadas] = useState<Record<number, string | null>>({})
  const [avance, setAvance] = useState<Trabajo | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null)

  const cargar = useCallback(async () => {
    if (!fichas?.length) { setRows([]); return }
    const hace30 = new Date(Date.now() - 30 * 864e5).toISOString()
    const { data, error } = await supabase.from('actividades').select(SELECT_TRABAJO).in('tecnico_id', fichas.map(f => f.id))
      .or(`estado.in.(asignada,en_proceso,terminada),and(estado.eq.validada,validado_at.gte.${hace30})`).order('fecha_asignacion', { ascending: false }).limit(200)
    if (error) setMsg({ t: 'error', m: errorTexto(error) })
    const lista = (data ?? []) as unknown as Trabajo[]
    setRows(lista)
    const ex = await cargarExtras(lista); setAvances(ex.avances); setPortadas(ex.portadas)
  }, [fichas])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { // abrir en la pestaña que tenga trabajos
    if (!rows) return
    if (!rows.some(r => r.estado === 'en_proceso') && rows.some(r => r.estado === 'asignada')) setVista('hacer')
  }, [rows === null]) // eslint-disable-line react-hooks/exhaustive-deps

  async function iniciar(t: Trabajo) {
    if (!confirm(`¿Iniciar "${t.actividad}" en ${t.ordenes?.vehiculos?.marca} ${t.ordenes?.vehiculos?.modelo}?`)) return
    setOcupado(t.id)
    const { error } = await supabase.rpc('actividad_accion', { p_id: t.id, p_accion: 'iniciar' })
    setOcupado(null)
    if (error) return setMsg({ t: 'error', m: errorTexto(error) })
    setMsg({ t: 'ok', m: 'Trabajo iniciado. Registra tu avance conforme avances.' }); setVista('proceso'); cargar()
  }

  const grupos: Record<Vista, Trabajo[]> = {
    hacer: (rows ?? []).filter(r => r.estado === 'asignada'),
    proceso: (rows ?? []).filter(r => r.estado === 'en_proceso'),
    terminados: (rows ?? []).filter(r => r.estado === 'terminada' || r.estado === 'validada'),
  }
  const hora = new Date().getHours()
  const areas = [...new Set((fichas ?? []).map(f => f.area))]

  return (
    <div>
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-16 text-white">
        <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-40 w-[62%] object-cover object-[72%_55%] opacity-80 [mask-image:linear-gradient(to_left,black_40%,transparent)]" />
        <div className="relative flex items-center justify-between">
          {emp.logoUrl ? <img src={emp.logoUrl} alt="" className="h-10 rounded-xl bg-white object-contain px-1" /> : <span />}
          <button onClick={() => { setRows(null); cargar() }} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Actualizar"><RefreshCw className="h-5 w-5" /></button>
        </div>
        <div className="relative mt-4">
          <div className="text-sm text-emerald-100/80">{hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'},</div>
          <h1 className="text-[26px] leading-tight font-extrabold">{fichas?.[0]?.nombre?.split(' ')[0] ?? perfil?.nombre?.split(' ')[0]}</h1>
          <div className="mt-1 flex gap-1.5">{areas.map(a => (
            <span key={a} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{a === 'pintura' ? <Paintbrush className="h-3.5 w-3.5" /> : <Hammer className="h-3.5 w-3.5" />}{a === 'pintura' ? 'Pintor' : a === 'hojalateria' ? 'Hojalatero' : a}</span>
          ))}</div>
        </div>
      </header>

      <div className="relative z-10 -mt-10 space-y-4 px-4">
        <div className="grid grid-cols-3 gap-2.5">
          {([['hacer', 'Por hacer', ClipboardList, 'bg-sky-100 text-sky-700'], ['proceso', 'En proceso', Timer, 'bg-amber-100 text-amber-700'], ['terminados', 'Terminados', CheckCircle2, 'bg-emerald-100 text-emerald-700']] as [Vista, string, typeof Timer, string][]).map(([id, l, Ic, tono]) => (
            <button key={id} onClick={() => setVista(id)} className={`flex flex-col gap-1 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[.98] ${vista === id ? 'ring-2 ring-brand-500 shadow-[0_0_14px_rgba(29,180,100,.35)]' : 'ring-1 ring-slate-200/80'}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tono}`}><Ic className="h-[18px] w-[18px]" /></span>
              <span className="text-2xl leading-none font-extrabold text-slate-900">{rows ? grupos[id].length : '…'}</span>
              <span className="text-[11px] font-semibold text-slate-500">{l}</span>
            </button>
          ))}
        </div>

        {msg && <Aviso tipo={msg.t === 'ok' ? 'ok' : 'error'} onClose={() => setMsg(null)}>{msg.m}</Aviso>}
        {fichas && fichas.length > 0 && <BannerNotificaciones />}

        {fichas && fichas.length === 0 ? (
          <Vacio icono={PlayCircle}>Tu usuario todavía no está ligado a una ficha de técnico. Pide a Dirección que te ligue en <b>Mano de obra → Técnicos y tarifas → Editar → Usuario del sistema</b>.</Vacio>
        ) : !rows ? <Cargando /> : grupos[vista].length === 0 ? (
          <Vacio icono={vista === 'terminados' ? CheckCircle2 : ClipboardList}>{vista === 'hacer' ? 'No tienes trabajos nuevos por iniciar' : vista === 'proceso' ? 'No tienes trabajos en proceso' : 'Sin trabajos terminados en los últimos 30 días'}</Vacio>
        ) : (
          <div className="space-y-3">
            {grupos[vista].map(t => <TarjetaTrabajo key={t.id} t={t} av={avances[t.id]} portada={portadas[t.orden_id]} ocupado={ocupado === t.id} onIniciar={() => iniciar(t)} onAvance={() => setAvance(t)} />)}
          </div>
        )}
      </div>

      {avance && <HojaAvance t={avance} actual={pctTrabajo(avance, avances[avance.id])} onClose={() => setAvance(null)}
        onListo={m => { const fin = m.startsWith('¡'); setAvance(null); setMsg({ t: 'ok', m }); if (fin) setVista('terminados'); cargar() }} />}
    </div>
  )
}
