import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KanbanSquare, ListChecks } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { ETAPAS, ETAPAS_TABLERO, fecha } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Modal, PageHeader, Tabs, useTab } from '../../components/ui'
import { Galeria, Miniatura } from '../../components/Fotos'
import { CambioEtapa } from '../expediente/General'
import { ListaActividades } from '../taller/produccion'
import { EtapaBadge } from '../Inicio'

/** Panel rápido desde el tablero: mover de etapa y adjuntar evidencia sin abrir el expediente completo */
function PanelVehiculo({ id, onClose }: { id: number; onClose: () => void }) {
  const al = useAlertas()
  const [o, setO] = useState<VOrden | null>(null)
  const cargar = () => supabase.from('v_ordenes').select('*').eq('id', id).single().then(({ data }) => setO(data as VOrden))
  useEffect(() => { cargar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return null
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  return (
    <Modal title={`${o.folio} · ${o.marca} ${o.modelo} ${o.placas ?? ''}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <EtapaBadge o={o} />
        <span className="text-slate-500">{o.aseguradora_nombre ?? 'Particular'} · {o.cliente_nombre}</span>
        <span className="text-slate-500">Compromiso: <b className={o.retrasado ? 'text-red-600' : ''}>{fecha(o.fecha_compromiso)}</b> · {o.dias_en_taller} días en taller</span>
        <Link to={`/ordenes/${o.id}`} className="btn btn-secondary btn-sm ml-auto">Abrir expediente completo</Link>
      </div>
      <div className="space-y-4">
        <CambioEtapa o={o} recargar={() => { cargar(); al.recargar() }} />
        <div className="card">
          <div className="mb-2 font-bold">Evidencias del proceso</div>
          <Galeria ordenId={o.id} categoria="proceso" puedeSubir={!cerrada} />
        </div>
      </div>
    </Modal>
  )
}

function Tablero() {
  const al = useAlertas()
  const [entregadas, setEntregadas] = useState<VOrden[]>([])
  const [tipo, setTipo] = useState<'todos' | 'aseguradora' | 'particular'>('todos')
  const [ver, setVer] = useState<number | null>(null)
  useEffect(() => {
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7)
    supabase.from('v_ordenes').select('*').eq('etapa', 'entregado').gte('fecha_entrega', hace7.toISOString()).order('fecha_entrega', { ascending: false })
      .then(({ data }) => setEntregadas((data ?? []) as VOrden[]))
  }, [al.activas])
  const todas = [...al.activas, ...entregadas].filter(o => tipo === 'todos' || o.tipo === tipo)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['todos', 'aseguradora', 'particular'] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === t ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t === 'todos' ? 'Todos' : t === 'aseguradora' ? 'Aseguradora' : 'Particulares'}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">Toca una tarjeta para cambiar su etapa o subir evidencias · Entregados: últimos 7 días</span>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {ETAPAS_TABLERO.map(e => {
          const items = todas.filter(o => o.etapa === e)
          return (
            <div key={e} className="flex w-64 shrink-0 flex-col rounded-2xl bg-slate-200/60 p-2">
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ETAPAS[e].color }} />{ETAPAS[e].label}</span>
                <span className="rounded-full bg-white px-2 text-xs font-bold text-slate-600">{items.length}</span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {items.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Sin vehículos</div>}
                {items.map(o => (
                  <button key={o.id} onClick={() => setVer(o.id)} className={`rounded-xl border bg-white p-2.5 text-left shadow-sm transition hover:shadow-md ${o.retrasado ? 'border-red-300' : 'border-transparent'}`}>
                    <div className="flex gap-2.5">
                      <Miniatura path={o.foto_portada} className="h-14 w-16" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between"><span className="text-sm font-bold">{o.folio}</span><span className="font-mono text-xs text-slate-500">{o.placas}</span></div>
                        <div className="truncate text-xs text-slate-600">{o.marca} {o.modelo} {o.anio}</div>
                        <div className="truncate text-[11px] text-slate-400">{o.aseguradora_nombre ?? 'Particular'}</div>
                      </div>
                    </div>
                    <div className="mt-2 truncate text-[11px] text-slate-500">👤 {o.tecnicos_activos ?? o.asesor_nombre ?? 'Sin responsable'}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className={o.retrasado ? 'font-bold text-red-600' : 'text-slate-500'}>📅 {fecha(o.fecha_compromiso)}{o.retrasado && ' · retrasado'}</span>
                      <span className="rounded bg-slate-100 px-1.5 font-semibold text-slate-600">{o.dias_en_taller} d</span>
                    </div>
                    {o.detenido_material && <div className="mt-1 rounded bg-orange-50 px-1.5 text-[11px] font-semibold text-orange-700">Detenido por material</div>}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {ver && <PanelVehiculo id={ver} onClose={() => { setVer(null); al.recargar() }} />}
    </div>
  )
}

export default function Procesos() {
  const tab = useTab('tablero')
  return (
    <div>
      <PageHeader title="Procesos del taller" subtitle="Tablero de producción por etapa" />
      <Tabs tabs={[
        { id: 'tablero', label: 'Tablero de producción', icon: KanbanSquare },
        { id: 'trabajos', label: 'Trabajos en curso', icon: ListChecks },
      ]} />
      {tab === 'tablero' ? <Tablero /> : <ListaActividades />}
    </div>
  )
}
