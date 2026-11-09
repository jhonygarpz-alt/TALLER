import { Link } from 'react-router-dom'
import { CalendarClock, CalendarDays, Eye, HardHat, PackageX, Settings2 } from 'lucide-react'
import { fecha, money } from '../lib/format'
import type { VOrden } from '../lib/tipos'
import { EtapaBadge } from '../pages/Inicio'
import { Miniatura } from './Fotos'

/** Tarjeta visual de una orden de trabajo (vista de tarjetas del módulo Órdenes) */
export default function VehicleCard({ o, avance, importe }: { o: VOrden; avance?: number | null; importe?: number | null }) {
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  return (
    <article className="group flex flex-col overflow-hidden rounded-[22px] border border-[#d7e7ec] bg-gradient-to-b from-white to-[#f6fbfc] shadow-[0_1px_2px_rgba(16,44,67,.05),0_14px_30px_-20px_rgba(16,44,67,.45)] transition duration-200 hover:-translate-y-0.5 hover:border-[#a7d8e2] hover:shadow-[0_2px_4px_rgba(16,44,67,.06),0_22px_40px_-20px_rgba(23,101,124,.55)]">
      <div className="relative m-2 mb-0 overflow-hidden rounded-[16px]">
        <Miniatura auto={o} path={o.foto_portada} className="h-44 w-full !rounded-[16px]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b2133]/45 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5"><EtapaBadge o={o} /></div>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[#102c43]/80 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{o.tipo === 'aseguradora' ? (o.aseguradora_nombre ?? 'Aseguradora') : 'Particular'}</span>
        {o.detenido_material && <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[11px] font-semibold text-white"><PackageX className="h-3 w-3" /> Sin material</span>}
        {importe != null && <span className="absolute right-2.5 bottom-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[12px] font-bold text-[#193344]">{money(importe)}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[17px] font-bold tracking-tight text-[#193344]">{o.folio}</span>
          <span className="text-[11.5px] text-[#66818f]">{o.dias_en_taller} días</span>
        </div>
        <div className="truncate text-[13.5px] font-medium text-[#193344]">{o.marca} {o.modelo} {o.anio ?? ''}</div>
        <div className="truncate text-[12.5px] text-[#66818f]">{o.placas ?? 'Sin placas'} · {o.cliente_nombre}</div>
        <dl className="mt-2.5 space-y-1 text-[12px] text-[#40606e]">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#55b6ca]" /> Ingreso {fecha(o.fecha_ingreso)}</div>
          <div className={`flex items-center gap-1.5 ${o.retrasado ? 'font-semibold text-red-600' : ''}`}><CalendarClock className="h-3.5 w-3.5 text-[#55b6ca]" /> Compromiso {fecha(o.fecha_compromiso)}</div>
          <div className="flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5 text-[#55b6ca]" /> <span className="truncate">{o.tecnicos_activos ?? (o.asesor_nombre ? `Asesor: ${o.asesor_nombre}` : 'Sin técnico asignado')}</span></div>
        </dl>
        {avance != null && !cerrada && (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-[11px] text-[#66818f]"><span>Avance de trabajos</span><b className="text-[#193344]">{Math.round(avance)}%</b></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e3eff3]"><div className="h-full rounded-full bg-gradient-to-r from-[#55b6ca] to-[#17657c]" style={{ width: `${Math.max(3, avance)}%` }} /></div>
          </div>
        )}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3.5">
          <Link to={`/ordenes/${o.id}`} className="btn btn-secondary btn-sm !py-2"><Eye className="h-4 w-4" /> Ver detalle</Link>
          <Link to={`/ordenes/${o.id}?tab=trabajos`} className="btn btn-dark btn-sm !py-2" title="Trabajos, avance, etapa y entrega de la orden"><Settings2 className="h-4 w-4" /> Gestionar</Link>
        </div>
      </div>
    </article>
  )
}
