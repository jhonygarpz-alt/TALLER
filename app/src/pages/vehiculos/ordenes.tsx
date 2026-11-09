import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, Car, ChevronLeft, ChevronRight, Columns3, Download, LayoutGrid, Rows3, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { ETAPAS, ETAPAS_TABLERO, ESTATUS_CONTACTO, fecha, hoyISO, limpiaBusqueda, money, type Etapa } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { VOrden } from '../../lib/tipos'
import { Badge, Card, Empty } from '../../components/ui'
import { Miniatura } from '../../components/Fotos'
import VehicleCard from '../../components/VehicleCard'
import { EtapaBadge } from '../Inicio'

const FILTROS: Record<string, string> = {
  activos: 'En taller', retrasados: 'Retrasados', proximos: 'Próximos a vencer', detenidos: 'Detenidos por material',
  sin_actualizar: 'Sin actualización', particulares: 'Particulares activos', aseguradora: 'Aseguradora activos', todos: 'Todos',
}
type Vista = 'tarjetas' | 'tabla' | 'kanban'
type Orden = 'reciente' | 'antiguo' | 'compromiso' | 'dias'
const ORDENES: Record<Orden, string> = { reciente: 'Ingreso más reciente', antiguo: 'Ingreso más antiguo', compromiso: 'Fecha compromiso', dias: 'Más días en taller' }
const POR_PAGINA = 24
const leerVista = (): Vista => { try { return (localStorage.getItem('ordenes.vista') as Vista) || 'tarjetas' } catch { return 'tarjetas' } }
const dia = (ts: string) => new Date(ts).toLocaleDateString('en-CA')

export function ListaOrdenes() {
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const al = useAlertas()
  const { puede } = useAuth()
  const filtro = sp.get('filtro') ?? (sp.get('q') ? 'todos' : 'activos')
  const q = sp.get('q') ?? ''
  const [busca, setBusca] = useState(q)
  const [rows, setRows] = useState<VOrden[]>([])
  const [asigs, setAsigs] = useState<{ id: number; siniestro: string; asegurado: string; placas: string | null; estatus: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVistaS] = useState<Vista>(leerVista)
  const [tecnico, setTecnico] = useState('')
  const [aseg, setAseg] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [orden, setOrden] = useState<Orden>('reciente')
  const [pagina, setPagina] = useState(0)
  const [avance, setAvance] = useState<Record<number, number>>({})
  const [importes, setImportes] = useState<Record<number, number>>({})
  const verFin = puede('finanzas.ver')
  const setVista = (v: Vista) => { setVistaS(v); try { localStorage.setItem('ordenes.vista', v) } catch { /* sin almacenamiento */ } }

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
    if (s) query = query.or(['folio', 'os_bitacora', 'placas', 'siniestro', 'cliente_nombre', 'marca', 'modelo'].map(c => `${c}.ilike.%${s}%`).join(','))
    query.then(({ data }) => { setRows((data ?? []) as VOrden[]); setCargando(false) })
    if (s) {
      supabase.from('asignaciones').select('id,siniestro,asegurado,placas,estatus').neq('estatus', 'ingresado')
        .or(['siniestro', 'asegurado', 'placas', 'telefono'].map(c => `${c}.ilike.%${s}%`).join(',')).limit(20)
        .then(({ data }) => setAsigs(data ?? []))
    } else setAsigs([])
  }, [filtro, q, al.proximas, al.detenidas, al.sinActualizar])

  // Avance de trabajos (terminados / total) e importe autorizado de las órdenes cargadas (solo lectura)
  useEffect(() => {
    const ids = rows.map(r => r.id)
    if (!ids.length) { setAvance({}); setImportes({}); return }
    supabase.from('actividades').select('orden_id, estado').in('orden_id', ids).neq('estado', 'cancelada').then(({ data }) => {
      const t: Record<number, [number, number]> = {}
      for (const x of data ?? []) { const v = (t[x.orden_id] ??= [0, 0]); v[1]++; if (x.estado === 'terminada' || x.estado === 'validada') v[0]++ }
      setAvance(Object.fromEntries(Object.entries(t).map(([k, [h, n]]) => [k, n ? (h / n) * 100 : 0])))
    })
    if (verFin) supabase.from('v_rentabilidad').select('orden_id, autorizado, adicional').in('orden_id', ids).then(({ data }) =>
      setImportes(Object.fromEntries((data ?? []).map(r => [r.orden_id, Number(r.autorizado) + Number(r.adicional ?? 0)]))))
  }, [rows, verFin])

  const tecnicos = useMemo(() => [...new Set(rows.flatMap(r => (r.tecnicos_activos ?? '').split(',').map(s => s.trim()).filter(Boolean)))].sort(), [rows])
  const aseguradoras = useMemo(() => [...new Set(rows.map(r => r.tipo === 'particular' ? 'Particular' : (r.aseguradora_nombre ?? 'Aseguradora')))].sort(), [rows])
  const vistas = useMemo(() => {
    const f = rows.filter(r =>
      (!tecnico || (r.tecnicos_activos ?? '').split(',').map(s => s.trim()).includes(tecnico)) &&
      (!aseg || (r.tipo === 'particular' ? 'Particular' : (r.aseguradora_nombre ?? 'Aseguradora')) === aseg) &&
      (!desde || dia(r.fecha_ingreso) >= desde) && (!hasta || dia(r.fecha_ingreso) <= hasta))
    const cmp: Record<Orden, (a: VOrden, b: VOrden) => number> = {
      reciente: (a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso), antiguo: (a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso),
      compromiso: (a, b) => (a.fecha_compromiso ?? '9999').localeCompare(b.fecha_compromiso ?? '9999'), dias: (a, b) => b.dias_en_taller - a.dias_en_taller,
    }
    return [...f].sort(cmp[orden])
  }, [rows, tecnico, aseg, desde, hasta, orden])
  useEffect(() => setPagina(0), [vistas.length, filtro, q, vista])
  const paginas = Math.max(1, Math.ceil(vistas.length / POR_PAGINA))
  const pag = vistas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const extras = [tecnico, aseg, desde, hasta].filter(Boolean).length

  const setFiltro = (f: string) => { const n = new URLSearchParams(); n.set('filtro', f); setSp(n) }
  const etapaSel = filtro.startsWith('etapa:') ? filtro.slice(6) : ''
  const etapaLabel = etapaSel ? etapaSel.split(',').map(e => ETAPAS[e as Etapa]?.label).join(' / ') : null
  const limpiar = () => { setSp(new URLSearchParams()); setTecnico(''); setAseg(''); setDesde(''); setHasta(''); setOrden('reciente') }

  function exportar() {
    descargarCSV('ordenes', vistas.map(o => ({ ...o, etapa: ETAPAS[o.etapa].label, retrasado: o.retrasado ? 'Sí' : 'No' })), [
      { key: 'folio', label: 'Folio' }, { key: 'tipo', label: 'Tipo' }, { key: 'aseguradora_nombre', label: 'Aseguradora' },
      { key: 'siniestro', label: 'Siniestro' }, { key: 'cliente_nombre', label: 'Cliente' }, { key: 'marca', label: 'Marca' },
      { key: 'modelo', label: 'Modelo' }, { key: 'anio', label: 'Año' }, { key: 'placas', label: 'Placas' }, { key: 'etapa', label: 'Etapa' },
      { key: 'fecha_ingreso', label: 'Ingreso' }, { key: 'fecha_compromiso', label: 'Compromiso' }, { key: 'fecha_entrega', label: 'Entrega' },
      { key: 'dias_en_taller', label: 'Días' }, { key: 'retrasado', label: 'Retrasado' }, { key: 'motivo_retraso', label: 'Motivo retraso' },
      { key: 'tecnicos_activos', label: 'Técnicos' }, { key: 'asesor_nombre', label: 'Asesor' },
    ])
  }

  const segmento = (v: Vista, Icono: typeof Rows3, label: string) => (
    <button onClick={() => setVista(v)} aria-pressed={vista === v} title={`Vista de ${label.toLowerCase()}`}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${vista === v ? 'bg-gradient-to-b from-[#2bb0c8] to-[#1d8299] text-white shadow' : 'text-[#c5e6ed]/80 hover:text-white'}`}>
      <Icono className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda, estado y vista */}
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-[220px] flex-1 md:max-w-sm" onSubmit={e => { e.preventDefault(); const n = new URLSearchParams(); if (busca.trim()) n.set('q', busca.trim()); n.set('filtro', 'todos'); setSp(n) }}>
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#8aa2ad]" />
          <input className="input !rounded-full !pl-10" placeholder="Folio, OS, placas, siniestro, cliente…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar órdenes" />
        </form>
        <div className="flex gap-1 rounded-full bg-[#102c43] p-1">
          {['activos', 'retrasados', 'todos'].map(k => (
            <button key={k} onClick={() => setFiltro(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${filtro === k ? 'bg-white text-[#102c43]' : 'text-[#c5e6ed]/80 hover:text-white'}`}>
              {FILTROS[k]}{k === 'retrasados' && al.retrasadas.length > 0 && <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{al.retrasadas.length}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-full bg-[#102c43] p-1">
          {segmento('tarjetas', LayoutGrid, 'Tarjetas')}{segmento('tabla', Rows3, 'Tabla')}{segmento('kanban', Columns3, 'Kanban')}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-[#dbe9ee] bg-white/75 p-2.5 backdrop-blur">
        <SlidersHorizontal className="ml-1 h-4 w-4 text-[#2298af]" />
        <select className="input !w-auto !rounded-full !py-2" value={filtro.startsWith('etapa:') ? '' : filtro} onChange={e => setFiltro(e.target.value)} aria-label="Estado de las órdenes">
          {etapaLabel && <option value="">Etapa: {etapaLabel}</option>}
          {Object.entries(FILTROS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input !w-auto !rounded-full !py-2" value={etapaSel.includes(',') ? '' : etapaSel} onChange={e => e.target.value ? setFiltro('etapa:' + e.target.value) : setFiltro('activos')} aria-label="Filtrar por etapa">
          <option value="">Todas las etapas</option>
          {Object.entries(ETAPAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input !w-auto !rounded-full !py-2" value={tecnico} onChange={e => setTecnico(e.target.value)} aria-label="Filtrar por técnico">
          <option value="">Todos los técnicos</option>{tecnicos.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input !w-auto !rounded-full !py-2" value={aseg} onChange={e => setAseg(e.target.value)} aria-label="Filtrar por aseguradora">
          <option value="">Aseguradora y particular</option>{aseguradoras.map(t => <option key={t}>{t}</option>)}
        </select>
        <label className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#66818f]">Ingreso
          <input type="date" className="input !w-auto !rounded-full !py-1.5" value={desde} onChange={e => setDesde(e.target.value)} aria-label="Ingreso desde" />–
          <input type="date" className="input !w-auto !rounded-full !py-1.5" value={hasta} onChange={e => setHasta(e.target.value)} aria-label="Ingreso hasta" />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-[#66818f]"><ArrowDownUp className="h-4 w-4" />
          <select className="input !w-auto !rounded-full !py-2" value={orden} onChange={e => setOrden(e.target.value as Orden)} aria-label="Ordenar por">
            {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {(q || filtro !== 'activos' || extras > 0) && <button className="btn btn-ghost btn-sm" onClick={limpiar}><X className="h-4 w-4" /> Limpiar</button>}
        <button className="btn btn-secondary btn-sm ml-auto" onClick={exportar} title="Descargar las órdenes filtradas"><Download className="h-4 w-4" /> Excel</button>
      </div>

      {asigs.length > 0 && (
        <Card title="Asignaciones que coinciden (aún no ingresan)">
          <ul className="divide-y divide-[#edf4f6] text-sm">{asigs.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <span><b>{a.siniestro}</b> · {a.asegurado} {a.placas && <span className="text-[#66818f]">· {a.placas}</span>}</span>
              <Link className="text-brand-700 hover:underline" to={`/ordenes?tab=asignaciones&ver=${a.id}`}><Badge cls={ESTATUS_CONTACTO[a.estatus].badge}>{ESTATUS_CONTACTO[a.estatus].label}</Badge></Link>
            </li>))}
          </ul>
        </Card>
      )}

      {cargando ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto h-[380px] !rounded-[22px]" />)}</div>
      ) : vistas.length === 0 ? (
        <Card><Empty icon={Car}>No hay órdenes con estos filtros. Prueba quitar algún filtro o cambiar el estado.</Empty></Card>
      ) : vista === 'tarjetas' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pag.map(o => <VehicleCard key={o.id} o={o} avance={avance[o.id] ?? null} importe={verFin && importes[o.id] ? importes[o.id] : null} />)}
        </div>
      ) : vista === 'tabla' ? (
        <Card pad={false}>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="tbl tbl-neon">
              <thead><tr><th>Orden</th><th>Vehículo</th><th>Cliente / Aseguradora</th><th>Estado</th><th>Responsable</th><th>Avance</th><th>Compromiso</th><th className="text-right">Días</th>{verFin && <th className="text-right">Importe</th>}</tr></thead>
              <tbody>{pag.map(o => (
                <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/ordenes/${o.id}`)}>
                  <td className="font-bold whitespace-nowrap">{o.folio}{o.detenido_material && <div className="text-[11px] font-semibold text-orange-600">Detenido por material</div>}</td>
                  <td><div className="flex items-center gap-3"><Miniatura auto={o} path={o.foto_portada} /><div className="whitespace-nowrap"><div className="font-medium">{o.marca} {o.modelo} {o.anio}</div><div className="text-xs text-[#66818f]">{o.placas ?? '—'} {o.color && `· ${o.color}`}</div></div></div></td>
                  <td className="min-w-[200px]"><div className="font-medium">{o.aseguradora_nombre ?? 'Particular'}</div><div className="text-xs text-[#66818f]">{o.siniestro ? `${o.siniestro} · ` : ''}{o.cliente_nombre}</div></td>
                  <td><EtapaBadge o={o} /></td>
                  <td className="text-xs">{o.tecnicos_activos ?? o.asesor_nombre ?? '—'}</td>
                  <td className="w-28">{avance[o.id] != null && o.etapa !== 'entregado' ? <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e3eff3]"><div className="h-full rounded-full bg-[#2298af]" style={{ width: `${avance[o.id]}%` }} /></div><span className="text-[11px] text-[#66818f]">{Math.round(avance[o.id])}%</span></div> : <span className="text-[#a9c1ca]">—</span>}</td>
                  <td className={`whitespace-nowrap ${o.retrasado ? 'font-semibold text-red-600' : ''}`}>{fecha(o.fecha_compromiso)}</td>
                  <td className="text-right">{o.dias_en_taller}</td>
                  {verFin && <td className="text-right whitespace-nowrap">{importes[o.id] ? money(importes[o.id]) : '—'}</td>}
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Kanban rows={vistas} />
      )}

      {vistas.length > 0 && vista !== 'kanban' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[#66818f]">
          <span>{vistas.length} órdenes{vistas.length !== rows.length ? ` (de ${rows.length} cargadas)` : ''}</span>
          {paginas > 1 && (
            <div className="flex items-center gap-1">
              <button className="btn btn-secondary btn-sm" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2">Página {pagina + 1} de {paginas}</span>
              <button className="btn btn-secondary btn-sm" disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Vista Kanban de consulta: agrupa las órdenes filtradas por etapa. Los cambios de etapa se hacen en el expediente (con sus reglas). */
function Kanban({ rows }: { rows: VOrden[] }) {
  const etapas = [...ETAPAS_TABLERO, 'cancelado' as Etapa].filter(e => rows.some(r => r.etapa === e))
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-w-max gap-3">
        {etapas.map(e => {
          const col = rows.filter(r => r.etapa === e)
          return (
            <section key={e} className="w-[270px] shrink-0 rounded-[20px] border border-[#d7e7ec] bg-white/70 p-2.5 backdrop-blur">
              <header className="mb-2 flex items-center justify-between px-1.5">
                <span className="flex items-center gap-2 text-[13px] font-bold text-[#193344]"><i className="h-2.5 w-2.5 rounded-full" style={{ background: ETAPAS[e].color }} />{ETAPAS[e].label}</span>
                <span className="rounded-full bg-[#e3f3f7] px-2 text-[11px] font-bold text-[#17657c]">{col.length}</span>
              </header>
              <div className="max-h-[66vh] space-y-2 overflow-y-auto pr-0.5">
                {col.map(o => (
                  <Link key={o.id} to={`/ordenes/${o.id}`} className="flex gap-2.5 rounded-2xl border border-[#e3eef2] bg-white p-2 transition hover:border-[#a7d8e2] hover:shadow-sm">
                    <Miniatura auto={o} path={o.foto_portada} className="h-14 w-16 !rounded-xl" />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center justify-between gap-1"><b className="text-[13px] text-[#193344]">{o.folio}</b>{o.retrasado && <span className="rounded-full bg-red-50 px-1.5 text-[10px] font-semibold text-red-600">Retraso</span>}</div>
                      <div className="truncate text-[12px] text-[#40606e]">{o.marca} {o.modelo}</div>
                      <div className="truncate text-[11px] text-[#66818f]">{o.placas ?? '—'} · {o.aseguradora_nombre ?? 'Particular'}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-[#66818f]">Vista de consulta. Para mover una orden de etapa abre su expediente: ahí se aplican las reglas de autorización y validación.</p>
    </div>
  )
}
