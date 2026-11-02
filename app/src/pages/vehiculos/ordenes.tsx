import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Car, Download, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

import { useAlertas } from '../../lib/alertas'
import { ETAPAS, ESTATUS_CONTACTO, fecha, hoyISO, limpiaBusqueda, type Etapa } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { VOrden } from '../../lib/tipos'
import { Badge, Card, Empty } from '../../components/ui'
import { Miniatura } from '../../components/Fotos'
import { EtapaBadge } from '../Inicio'


const FILTROS: Record<string, string> = {
  activos: 'En taller', retrasados: 'Retrasados', proximos: 'Próximos a vencer', detenidos: 'Detenidos por material',
  sin_actualizar: 'Sin actualización', particulares: 'Particulares activos', aseguradora: 'Aseguradora activos', todos: 'Todos',
}

export function ListaOrdenes() {
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const al = useAlertas()
  const filtro = sp.get('filtro') ?? (sp.get('q') ? 'todos' : 'activos')
  const q = sp.get('q') ?? ''
  const [busca, setBusca] = useState(q)
  const [rows, setRows] = useState<VOrden[]>([])
  const [asigs, setAsigs] = useState<{ id: number; siniestro: string; asegurado: string; placas: string | null; estatus: string }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => setBusca(q), [q])

  useEffect(() => {
    setCargando(true)
    const desdeAlertas: Record<string, VOrden[]> = { proximos: al.proximas, detenidos: al.detenidas, sin_actualizar: al.sinActualizar }
    if (desdeAlertas[filtro] && !q) { setRows(desdeAlertas[filtro]); setCargando(false); return }
    let query = supabase.from('v_ordenes').select('*').order('fecha_ingreso', { ascending: false }).limit(500)
    if (filtro.startsWith('etapa:')) query = query.in('etapa', filtro.slice(6).split(','))
    else if (filtro === 'activos') query = query.not('etapa', 'in', '(entregado,cancelado)')
    else if (filtro === 'retrasados') query = query.not('etapa', 'in', '(entregado,cancelado)').lt('fecha_compromiso', hoyISO())
    else if (filtro === 'particulares') query = query.eq('tipo', 'particular').not('etapa', 'in', '(entregado,cancelado)')
    else if (filtro === 'aseguradora') query = query.eq('tipo', 'aseguradora').not('etapa', 'in', '(entregado,cancelado)')
    const s = limpiaBusqueda(q)
    if (s) query = query.or(['folio', 'placas', 'siniestro', 'cliente_nombre', 'marca', 'modelo'].map(c => `${c}.ilike.%${s}%`).join(','))
    query.then(({ data }) => { setRows((data ?? []) as VOrden[]); setCargando(false) })
    if (s) {
      supabase.from('asignaciones').select('id,siniestro,asegurado,placas,estatus').neq('estatus', 'ingresado')
        .or(['siniestro', 'asegurado', 'placas', 'telefono'].map(c => `${c}.ilike.%${s}%`).join(',')).limit(20)
        .then(({ data }) => setAsigs(data ?? []))
    } else setAsigs([])
  }, [filtro, q, al.proximas, al.detenidas, al.sinActualizar])

  const setFiltro = (f: string) => { const n = new URLSearchParams(); n.set('filtro', f); setSp(n) }
  const etapaLabel = filtro.startsWith('etapa:') ? filtro.slice(6).split(',').map(e => ETAPAS[e as Etapa]?.label).join(' / ') : null

  function exportar() {
    descargarCSV('ordenes', rows.map(o => ({ ...o, etapa: ETAPAS[o.etapa].label, retrasado: o.retrasado ? 'Sí' : 'No' })), [
      { key: 'folio', label: 'Folio' }, { key: 'tipo', label: 'Tipo' }, { key: 'aseguradora_nombre', label: 'Aseguradora' },
      { key: 'siniestro', label: 'Siniestro' }, { key: 'cliente_nombre', label: 'Cliente' }, { key: 'marca', label: 'Marca' },
      { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'placas', label: 'Placas' }, { key: 'etapa', label: 'Etapa' },
      { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'fecha_compromiso', label: 'Compromiso' }, { key: 'fecha_entrega', label: 'Entrega' },
      { key: 'dias_en_taller', label: 'Días' }, { key: 'retrasado', label: 'Retrasado' }, { key: 'motivo_retraso', label: 'Motivo retraso' },
      { key: 'tecnicos_activos', label: 'Técnicos' }, { key: 'asesor_nombre', label: 'Asesor' },
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative" onSubmit={e => { e.preventDefault(); const n = new URLSearchParams(); if (busca.trim()) n.set('q', busca.trim()); n.set('filtro', 'todos'); setSp(n) }}>
          <input className="input w-64" placeholder="Folio, placas, siniestro, cliente…" value={busca} onChange={e => setBusca(e.target.value)} />
        </form>
        <select className="input w-auto" value={filtro.startsWith('etapa:') ? '' : filtro} onChange={e => setFiltro(e.target.value)}>
          {etapaLabel && <option value="">Etapa: {etapaLabel}</option>}
          {Object.entries(FILTROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-auto" value="" onChange={e => e.target.value && setFiltro('etapa:' + e.target.value)}>
          <option value="">Filtrar por etapa…</option>
          {Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(q || filtro !== 'activos') && <button className="btn btn-ghost btn-sm" onClick={() => setSp(new URLSearchParams())}><X className="h-4 w-4" /> Limpiar</button>}
        <button className="btn btn-secondary btn-sm ml-auto" onClick={exportar}><Download className="h-4 w-4" /> Excel</button>
      </div>

      {asigs.length > 0 && (
        <Card title="Asignaciones que coinciden (aún no ingresan)">
          <ul className="divide-y text-sm">{asigs.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <span><b>{a.siniestro}</b> · {a.asegurado} {a.placas && <span className="text-slate-500">· {a.placas}</span>}</span>
              <Link className="text-brand-700 hover:underline" to={`/ordenes?tab=asignaciones&ver=${a.id}`}><Badge cls={ESTATUS_CONTACTO[a.estatus].badge}>{ESTATUS_CONTACTO[a.estatus].label}</Badge></Link>
            </li>))}
          </ul>
        </Card>
      )}

      <Card pad={false}>
        {cargando ? <div className="p-10 text-center text-slate-400">Cargando…</div> : rows.length === 0 ? <Empty icon={Car}>No hay órdenes con este filtro</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Orden</th><th>Vehículo</th><th>Cliente / Aseguradora</th><th>Estado</th><th>Responsable</th><th>Compromiso</th><th className="text-right">Días</th></tr></thead>
              <tbody>{rows.map(o => (
                <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/ordenes/${o.id}`)}>
                  <td className="font-bold whitespace-nowrap">{o.folio}{o.detenido_material && <div className="text-[11px] font-semibold text-orange-600">Detenido por material</div>}</td>
                  <td><div className="flex items-center gap-3"><Miniatura path={o.foto_portada} /><div><div className="font-medium">{o.marca} {o.modelo} {o.anio}</div><div className="text-xs text-slate-500">{o.placas ?? '—'} {o.color && `· ${o.color}`}</div></div></div></td>
                  <td><div className="font-medium">{o.aseguradora_nombre ?? 'Particular'}</div><div className="text-xs text-slate-500">{o.siniestro ? `${o.siniestro} · ` : ''}{o.cliente_nombre}</div></td>
                  <td><EtapaBadge o={o} /></td>
                  <td className="text-xs">{o.tecnicos_activos ?? o.asesor_nombre ?? '—'}</td>
                  <td className={`whitespace-nowrap ${o.retrasado ? 'font-semibold text-red-600' : ''}`}>{fecha(o.fecha_compromiso)}</td>
                  <td className="text-right">{o.dias_en_taller}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {rows.length > 0 && <p className="text-xs text-slate-400">{rows.length} órdenes</p>}
    </div>
  )
}
