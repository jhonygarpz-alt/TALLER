import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Camera, ClipboardList, DollarSign, FileText, Package, Printer, Truck, Wrench } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { fecha } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Badge, Tabs, useTab } from '../../components/ui'
import { Miniatura } from '../../components/Fotos'
import { EtapaBadge } from '../Inicio'
import General from './General'
import Diagnostico from './Diagnostico'
import Presupuesto from './Presupuesto'
import Trabajos from './Trabajos'
import Materiales from './Materiales'
import Costos from './Costos'
import Entrega from './Entrega'

export interface TabProps { o: VOrden; recargar: () => void }

export default function Expediente() {
  const id = Number(useParams().id)
  const tab = useTab('general')
  const al = useAlertas()
  const [o, setO] = useState<VOrden | null>(null)
  const [noExiste, setNoExiste] = useState(false)

  const recargar = useCallback(async () => {
    const { data } = await supabase.from('v_ordenes').select('*').eq('id', id).maybeSingle()
    if (!data) setNoExiste(true)
    setO(data as VOrden)
    al.recargar()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, [recargar])

  if (noExiste) return <div className="text-slate-500">La orden no existe o no tienes acceso.</div>
  if (!o) return <div className="text-slate-400">Cargando expediente…</div>
  const props = { o, recargar }

  return (
    <div>
      <div className="no-print"><Link to="/vehiculos" className="text-sm font-medium text-blue-600 hover:underline">← Vehículos</Link></div>
      <div className="card mt-2 mb-5 flex flex-col gap-4 md:flex-row md:items-center">
        <Miniatura path={o.foto_portada} className="h-24 w-full md:w-36" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">{o.folio}</h1>
            <EtapaBadge o={o} />
            <Badge cls={o.tipo === 'aseguradora' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'}>{o.aseguradora_nombre ?? 'Particular'}</Badge>
            {o.detenido_material && <Badge cls="bg-orange-100 text-orange-700"><AlertTriangle className="h-3 w-3" /> Detenido por material</Badge>}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-800">{o.marca} {o.modelo} {o.anio} <span className="font-mono text-base text-slate-500">{o.placas}</span></div>
          <div className="text-sm text-slate-500">{o.cliente_nombre}{o.siniestro && ` · Siniestro ${o.siniestro}`}{o.cliente_telefono && ` · ${o.cliente_telefono}`}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center md:w-80">
          <div className="rounded-xl bg-slate-50 p-2"><div className="text-[11px] text-slate-500">Ingreso</div><div className="text-sm font-bold">{fecha(o.fecha_ingreso)}</div></div>
          <div className={`rounded-xl p-2 ${o.retrasado ? 'bg-red-50' : 'bg-slate-50'}`}><div className="text-[11px] text-slate-500">Compromiso</div><div className={`text-sm font-bold ${o.retrasado ? 'text-red-600' : ''}`}>{fecha(o.fecha_compromiso)}</div></div>
          <div className="rounded-xl bg-slate-50 p-2"><div className="text-[11px] text-slate-500">Días</div><div className="text-sm font-bold">{o.dias_en_taller}</div></div>
        </div>
        <button className="btn btn-secondary btn-sm no-print self-start" onClick={() => window.print()} title="Imprimir o guardar como PDF"><Printer className="h-4 w-4" /></button>
      </div>

      <Tabs tabs={[
        { id: 'general', label: 'Información general', icon: ClipboardList },
        { id: 'diagnostico', label: 'Diagnóstico y fotos', icon: Camera },
        { id: 'presupuesto', label: 'Presupuesto y autorizaciones', icon: FileText },
        { id: 'trabajos', label: 'Trabajos y avance', icon: Wrench, count: Number(o.actividades_pendientes) || undefined },
        { id: 'materiales', label: 'Materiales y compras', icon: Package },
        { id: 'costos', label: 'Costos y destajos', icon: DollarSign },
        { id: 'entrega', label: 'Entrega y cierre', icon: Truck },
      ]} />
      {tab === 'general' && <General {...props} />}
      {tab === 'diagnostico' && <Diagnostico {...props} />}
      {tab === 'presupuesto' && <Presupuesto {...props} />}
      {tab === 'trabajos' && <Trabajos {...props} />}
      {tab === 'materiales' && <Materiales {...props} />}
      {tab === 'costos' && <Costos {...props} />}
      {tab === 'entrega' && <Entrega {...props} />}
    </div>
  )
}
