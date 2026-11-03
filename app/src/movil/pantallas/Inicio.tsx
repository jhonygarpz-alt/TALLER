import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Camera, CarFront, CheckCircle2, ChevronRight, ClipboardList, Download, Search, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useEmpresa } from '../../lib/empresa'
import { hoyISO } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Miniatura } from '../../components/Fotos'
import { BadgeEtapa, useInstalar } from '../ui'

export default function Inicio() {
  const { perfil, puede } = useAuth()
  const emp = useEmpresa()
  const { puedeInstalar, instalar } = useInstalar()
  const [ordenes, setOrdenes] = useState<VOrden[] | null>(null)
  const [misTrabajos, setMisTrabajos] = useState(0)

  useEffect(() => {
    supabase.from('v_ordenes').select('*').not('etapa', 'in', '(entregado,cancelado)').order('ultima_actualizacion', { ascending: false }).limit(200)
      .then(({ data }) => setOrdenes((data ?? []) as VOrden[]))
    supabase.from('tecnicos').select('id').eq('perfil_id', perfil?.id ?? '').then(async ({ data }) => {
      const ids = (data ?? []).map(t => t.id)
      if (!ids.length) return
      const { count } = await supabase.from('actividades').select('id', { count: 'exact', head: true }).in('tecnico_id', ids).in('estado', ['asignada', 'en_proceso'])
      setMisTrabajos(count ?? 0)
    })
  }, [perfil?.id])

  const hoy = hoyISO()
  const retrasadas = (ordenes ?? []).filter(o => o.fecha_compromiso && o.fecha_compromiso < hoy).length
  const listas = (ordenes ?? []).filter(o => o.etapa === 'listo_entrega').length
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  const kpi = (n: number | string, label: string, Icono: typeof Wrench, to: string, tono: string) => (
    <Link to={to} className="flex flex-col gap-1 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80 active:scale-[.98]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tono}`}><Icono className="h-5 w-5" /></span>
      <span className="mt-1 text-2xl leading-none font-extrabold text-slate-900">{n}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </Link>
  )

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-16 text-white">
        <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full bg-brand-500/25 blur-2xl" />
        <div className="relative flex items-center gap-3">
          {emp.logoUrl && <img src={emp.logoUrl} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-0.5" />}
          <div className="min-w-0">
            <div className="text-sm text-emerald-100/80">{saludo},</div>
            <div className="truncate text-xl font-extrabold">{perfil?.nombre?.split(' ')[0] ?? ''}</div>
          </div>
        </div>
        <Link to="/ordenes?buscar=1" className="relative mt-5 flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3.5 text-emerald-50/80 ring-1 ring-white/15 backdrop-blur active:bg-white/20">
          <Search className="h-5 w-5" /> Buscar por placas, folio, OS o cliente
        </Link>
      </div>

      <div className="relative z-10 -mt-10 space-y-5 px-4">
        <div className="grid grid-cols-3 gap-3">
          {kpi(ordenes ? ordenes.length : '…', 'En taller', CarFront, '/ordenes', 'bg-brand-100 text-brand-700')}
          {kpi(ordenes ? retrasadas : '…', 'Retrasadas', AlertTriangle, '/ordenes?filtro=retrasadas', 'bg-red-100 text-red-600')}
          {kpi(ordenes ? listas : '…', 'Listas', CheckCircle2, '/ordenes?filtro=listas', 'bg-sky-100 text-sky-700')}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {puede('ordenes.gestionar') && (
            <Link to="/nueva" className="col-span-2 flex items-center gap-4 rounded-3xl bg-gradient-to-r from-brand-600 to-brand-500 p-5 text-white shadow-lg shadow-brand-800/25 active:scale-[.98]">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20"><Camera className="h-7 w-7" /></span>
              <span className="flex-1"><span className="block text-lg font-extrabold">Recibir vehículo</span><span className="text-sm text-emerald-50/90">Nueva orden con fotos</span></span>
              <ChevronRight className="h-6 w-6" />
            </Link>
          )}
          <Link to="/trabajos" className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 active:scale-[.98]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Wrench className="h-6 w-6" /></span>
            <span className="font-bold">Mis trabajos</span><span className="text-xs text-slate-500">{misTrabajos ? `${misTrabajos} pendiente(s)` : 'Iniciar y terminar'}</span>
          </Link>
          <Link to="/ordenes" className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 active:scale-[.98]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><ClipboardList className="h-6 w-6" /></span>
            <span className="font-bold">Órdenes</span><span className="text-xs text-slate-500">Avance, fotos y etapa</span>
          </Link>
        </div>

        {puedeInstalar && (
          <button onClick={instalar} className="flex w-full items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-left ring-1 ring-emerald-200 active:scale-[.98]">
            <Download className="h-6 w-6 text-brand-700" />
            <span className="flex-1"><span className="block font-bold text-brand-800">Instalar la app</span><span className="text-xs text-emerald-800/80">Agrega el ícono a tu pantalla de inicio</span></span>
          </button>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between px-1"><h2 className="font-bold text-slate-900">Movimientos recientes</h2><Link to="/ordenes" className="text-sm font-semibold text-brand-700">Ver todas</Link></div>
          <div className="space-y-2.5">
            {(ordenes ?? []).slice(0, 6).map(o => (
              <Link key={o.id} to={`/orden/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200/80 active:bg-slate-50">
                <Miniatura auto={o} path={o.foto_portada} className="h-14 w-[72px] rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-bold">{o.folio}</span>{o.os_bitacora && <span className="text-xs text-slate-400">OS {o.os_bitacora}</span>}</div>
                  <div className="truncate text-sm text-slate-600">{o.marca} {o.modelo} · {o.placas ?? 's/placas'}</div>
                  <div className="mt-1"><BadgeEtapa etapa={o.etapa} /></div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
