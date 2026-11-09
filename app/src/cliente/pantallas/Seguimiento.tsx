import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarDays, CheckCircle2, ChevronRight, Loader2, LogOut, PartyPopper, RefreshCw, Share, ShieldCheck, SquarePlus, Star } from 'lucide-react'
import IlustracionAuto from '../../components/IlustracionAuto'
import { fecha, fechaHora } from '../../lib/format'
import { Aviso, Cargando } from '../../movil/ui'
import { activarAvisos, datos, logoUrl, pushSoportado, salir, type DatosCliente, type OrdenCliente } from '../api'

const PASOS = ['Recibido', 'Diagnóstico', 'Autorización', 'Reparación', 'Pintura', 'Detalles y calidad', 'Listo para entrega', 'Entregado']

function Linea({ o }: { o: OrdenCliente }) {
  const actual = o.estado.paso
  const fechaPaso = (n: number) => o.historial.find(h => h.estado.paso === n)?.fecha
  return (
    <ol className="relative ml-1 space-y-0">
      {PASOS.map((nombre, i) => {
        const n = i + 1; const hecho = n < actual; const ahora = n === actual
        const f = fechaPaso(n) ?? (n === 1 ? o.ingreso : undefined)
        return (
          <li key={nombre} className="relative flex gap-3 pb-4 last:pb-0">
            {n < PASOS.length && <span className={`absolute top-7 left-[13px] h-[calc(100%-20px)] w-0.5 ${hecho ? 'bg-brand-500' : 'bg-slate-200'}`} />}
            <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${hecho ? 'bg-brand-600 text-white' : ahora ? 'bg-white text-brand-700 ring-4 ring-brand-200 shadow-[0_0_12px_rgba(34,152,175,.55)]' : 'bg-slate-100 text-slate-400'}`}>
              {hecho ? <CheckCircle2 className="h-4 w-4" /> : n}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className={`text-sm ${ahora ? 'font-extrabold text-slate-900' : hecho ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>{nombre}</div>
              {ahora && <div className="text-xs text-brand-700">{o.estado.detalle}</div>}
              {(hecho || ahora) && f && <div className="text-[11px] text-slate-400">{fechaHora(f)}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Seguimiento({ token, onSalir }: { token: string; onSalir: () => void }) {
  const [d, setD] = useState<DatosCliente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [avisoMsg, setAvisoMsg] = useState<{ t: 'ok' | 'error'; m: string } | null>(null)
  const [activando, setActivando] = useState(false)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setD(await datos(token)); setError(null) } catch (e) { if ((e as Error).message === 'SESION_VENCIDA') onSalir(); else setError((e as Error).message) }
    setCargando(false)
  }, [token, onSalir])
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t) }, [cargar])

  if (!d) return <div className="p-6">{error ? <Aviso>{error}</Aviso> : <Cargando />}</div>
  const activa = d.ordenes.find(o => o.etapa !== 'entregado')
  const ultima = activa ?? d.ordenes[0]
  const pendientesEncuesta = d.ordenes.filter(o => o.etapa === 'entregado' && !o.satisfaccion)
  const v = d.vehiculo
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const instalada = window.matchMedia('(display-mode: standalone)').matches
  const logo = logoUrl(d.taller?.logo)

  async function avisos() {
    setActivando(true); setAvisoMsg(null)
    try { await activarAvisos(token); setAvisoMsg({ t: 'ok', m: 'Listo: te avisaremos cuando tu vehículo esté listo.' }); cargar() } catch (e) { setAvisoMsg({ t: 'error', m: (e as Error).message }) }
    setActivando(false)
  }

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-16 text-white">
        <img src={`${import.meta.env.BASE_URL}img/banner-taller.webp`} alt="" aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-40 w-[62%] object-cover object-[72%_55%] opacity-80 [mask-image:linear-gradient(to_left,black_40%,transparent)]" />
        <div className="relative flex items-center justify-between">
          {logo ? <img src={logo} alt={d.taller?.nombre} className="h-10 rounded-xl bg-white object-contain px-1" /> : <span className="font-bold">{d.taller?.nombre}</span>}
          <div className="flex">
            <button onClick={cargar} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Actualizar">{cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}</button>
            <button onClick={() => confirm('¿Salir de tu cuenta en este celular?') && salir(token).then(onSalir)} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15" aria-label="Salir"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="relative mt-4"><div className="text-sm text-cyan-100/80">Hola,</div><h1 className="text-[26px] leading-tight font-extrabold">{d.cliente?.nombre ?? 'cliente'}</h1></div>
      </header>

      <div className="relative z-10 -mt-10 space-y-4 px-4">
        <div className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200/80">
          <div className="h-[72px] w-[104px] shrink-0 overflow-hidden rounded-2xl"><IlustracionAuto modelo={v?.modelo} color={v?.color} conEtiqueta={false} /></div>
          <div className="min-w-0"><div className="text-lg leading-tight font-extrabold text-slate-900">{v?.marca} {v?.modelo} {v?.anio ?? ''}</div>
            <div className="text-sm text-slate-500">Placas <b className="text-brand-700">{v?.placas}</b>{v?.color && ` · ${v.color}`}</div></div>
        </div>

        {pendientesEncuesta.map(o => (
          <Link key={o.id} to={`/encuesta/${o.id}`} className="flex items-center gap-3 rounded-3xl bg-gradient-to-r from-amber-400 to-amber-500 p-4 text-white shadow-lg shadow-amber-900/20 active:scale-[.98]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25"><Star className="h-7 w-7" fill="currentColor" /></span>
            <span className="flex-1"><span className="block text-lg font-extrabold">¿Cómo te atendimos?</span><span className="text-sm text-amber-50">Califica el servicio {o.folio} · 1 minuto</span></span>
            <ChevronRight className="h-6 w-6" />
          </Link>
        ))}

        {ultima ? (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
            {ultima.etapa === 'listo_entrega' ? (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200"><PartyPopper className="h-8 w-8 shrink-0" /><div><div className="text-lg font-extrabold">¡Tu vehículo está listo!</div><div className="text-sm">Ya puedes pasar a recogerlo al taller.</div></div></div>
            ) : (
              <div className="mb-4"><div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Estado actual</div><div className="text-[22px] leading-tight font-extrabold text-slate-900">{ultima.estado.titulo}</div><div className="text-sm text-slate-500">{ultima.estado.detalle}</div></div>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-2.5"><div className="text-[11px] text-slate-500">Orden</div><div className="font-bold">{ultima.folio}</div></div>
              <div className="rounded-2xl bg-brand-50 p-2.5"><div className="flex items-center justify-center gap-1 text-[11px] text-brand-700"><CalendarDays className="h-3.5 w-3.5" />{ultima.etapa === 'entregado' ? 'Entregado' : 'Entrega estimada'}</div><div className="font-bold text-brand-800">{ultima.etapa === 'entregado' ? fecha(ultima.entrega) : ultima.compromiso && ultima.compromiso >= new Date().toLocaleDateString('en-CA') ? fecha(ultima.compromiso) : 'Por confirmar'}</div></div>
            </div>
            {ultima.aseguradora && <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><ShieldCheck className="h-4 w-4 text-brand-700" /> Servicio por aseguradora {ultima.aseguradora}</div>}
            <Linea o={ultima} />
          </div>
        ) : <Aviso tipo="info">Aún no hay servicios registrados para este vehículo.</Aviso>}

        {activa && (d.avisos > 0 ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200"><BellRing className="h-5 w-5" /> Te avisaremos en este celular cuando esté listo.</div>
        ) : (
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
            <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><BellRing className="h-6 w-6" /></span>
              <div><div className="font-bold">Recibe un aviso cuando esté listo</div>
                <div className="text-sm text-slate-500">{pushSoportado() ? 'Te mandaremos una notificación a este celular.' : ios && !instalada ? <>En iPhone, primero instala la app: <Share className="inline h-4 w-4" /> Compartir → <SquarePlus className="inline h-4 w-4" /> Agregar a inicio, y ábrela desde el ícono.</> : 'Este navegador no admite avisos; usa Chrome o la app instalada.'}</div></div></div>
            {avisoMsg && <div className="mt-3"><Aviso tipo={avisoMsg.t === 'ok' ? 'ok' : 'error'} onClose={() => setAvisoMsg(null)}>{avisoMsg.m}</Aviso></div>}
            {pushSoportado() && <button disabled={activando} onClick={avisos} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-bold text-white active:scale-[.98] disabled:opacity-60">{activando ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />} Activar avisos</button>}
          </div>
        ))}

        {d.ordenes.length > 1 && (
          <section>
            <h2 className="mb-2 px-1 font-bold text-slate-900">Servicios anteriores</h2>
            <div className="space-y-2">{d.ordenes.filter(o => o !== ultima).map(o => (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80">
                <div className="min-w-0 flex-1"><div className="font-bold">{o.folio}</div><div className="text-xs text-slate-500">{fecha(o.ingreso)} → {o.entrega ? fecha(o.entrega) : o.estado.titulo}</div></div>
                {o.satisfaccion ? <span className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: o.satisfaccion }, (_, i) => <Star key={i} className="h-4 w-4" fill="currentColor" />)}</span>
                  : o.etapa === 'entregado' ? <Link to={`/encuesta/${o.id}`} className="text-sm font-semibold text-brand-700">Calificar</Link> : null}
              </div>
            ))}</div>
          </section>
        )}
        <p className="px-4 text-center text-xs text-slate-400">La información se actualiza sola cada minuto.</p>
      </div>
    </div>
  )
}
