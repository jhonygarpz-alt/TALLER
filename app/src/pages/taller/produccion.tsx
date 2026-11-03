import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Pencil, Plus, Save, Smartphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { revertir } from '../../lib/revertir'
import { useAuth } from '../../lib/auth'

import { usePeriodo } from '../../lib/periodo'
import { AREAS, ROLES, ESTADO_ACTIVIDAD, ESTADO_DESTAJO, errorTexto, fecha, money2, num } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Tarifa, Tecnico } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, SinPermiso } from '../../components/ui'

import Actividades from '../../components/Actividades'
import PeriodoSelect from '../../components/PeriodoSelect'

export function ListaActividades() {
  const { perfil } = useAuth()
  const [sp, setSp] = useSearchParams()
  const estado = sp.get('estado') ?? 'abiertas'
  const [tecnico, setTecnico] = useState(sp.get('tecnico') ?? '')
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  useEffect(() => {
    supabase.from('tecnicos').select('*').order('nombre').then(({ data }) => {
      const t = (data ?? []) as Tecnico[]
      setTecnicos(t)
      const mio = t.find(x => x.perfil_id === perfil?.id)
      if (mio && perfil?.rol === 'tecnico' && !tecnico) setTecnico(String(mio.id))
    })
  }, [perfil]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input w-auto" value={estado} onChange={e => { const n = new URLSearchParams(sp); n.set('estado', e.target.value); setSp(n) }}>
          <option value="abiertas">Abiertas (asignadas, en proceso, por validar)</option>
          {Object.entries(ESTADO_ACTIVIDAD).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          <option value="todas">Todas</option>
        </select>
        <select className="input w-auto" value={tecnico} onChange={e => setTecnico(e.target.value)}>
          <option value="">Todos los técnicos</option>{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <Actividades filtroEstado={estado} filtroTecnico={tecnico || undefined} mostrarOrden />
    </Card>
  )
}

interface DestajoRow {
  id: number; orden_id: number; tecnico_id: number; tipo: string; importe: number; estado: string; generado_at: string
  autorizado_at: string | null; pagado_at: string | null; referencia_pago: string | null
  tecnicos?: { nombre: string }; ordenes?: { folio: string }; actividades?: { actividad: string; pieza: string | null; area: string }
}

export function Destajos() {
  const { puede } = useAuth()
  const [rows, setRows] = useState<DestajoRow[]>([])
  const [estado, setEstado] = useState('pendiente')
  const [tipo, setTipo] = useState('aseguradora')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    let q = supabase.from('destajos').select('*, tecnicos(nombre), ordenes(folio), actividades(actividad,pieza,area)').order('generado_at', { ascending: false }).limit(1000)
    if (estado !== 'todos') q = q.eq('estado', estado)
    if (tipo !== 'todos') q = q.eq('tipo', tipo)
    const { data } = await q
    setRows((data ?? []) as DestajoRow[]); setSel(new Set())
  }, [estado, tipo])
  useEffect(() => { cargar() }, [cargar])

  if (!puede('destajos.ver')) return <SinPermiso que="los destajos" />
  const seleccionados = rows.filter(r => sel.has(r.id))
  const totalSel = seleccionados.reduce((s, r) => s + Number(r.importe), 0)
  const porTecnico = Object.values(rows.reduce<Record<string, { nombre: string; total: number; n: number }>>((acc, r) => {
    const k = String(r.tecnico_id); acc[k] = acc[k] ?? { nombre: r.tecnicos?.nombre ?? '', total: 0, n: 0 }; acc[k].total += Number(r.importe); acc[k].n++; return acc
  }, {})).sort((a, b) => b.total - a.total)

  async function autorizar() {
    if (!confirm(`¿Autorizar ${seleccionados.length} destajo(s) por ${money2(totalSel)}?`)) return
    const { error } = await supabase.rpc('destajos_autorizar', { p_ids: [...sel] })
    setError(error ? errorTexto(error) : null); cargar()
  }
  async function pagar() {
    const ref = prompt(`Referencia del pago de ${money2(totalSel)} (nómina, transferencia, recibo):`)
    if (!ref) return
    const { error } = await supabase.rpc('destajos_pagar', { p_ids: [...sel], p_referencia: ref })
    setError(error ? errorTexto(error) : null); cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
          {[['aseguradora', 'Aseguradora (MAPFRE)'], ['particular', 'Particulares'], ['todos', 'Ambos']].map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)} className={`px-3 py-2 text-xs font-semibold ${tipo === k ? 'bg-navy-800 text-white' : 'bg-white text-slate-600'}`}>{l}</button>
          ))}
        </div>
        <select className="input w-auto" value={estado} onChange={e => setEstado(e.target.value)}>
          {Object.entries(ESTADO_DESTAJO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}<option value="todos">Todos</option>
        </select>
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('destajos', rows.map(r => ({ ...r, tecnico: r.tecnicos?.nombre, folio: r.ordenes?.folio, actividad: r.actividades?.actividad, pieza: r.actividades?.pieza, estado: ESTADO_DESTAJO[r.estado].label })), [
          { key: 'folio', label: 'Orden' }, { key: 'tipo', label: 'Tipo' }, { key: 'tecnico', label: 'Técnico' }, { key: 'actividad', label: 'Actividad' }, { key: 'pieza', label: 'Pieza' },
          { key: 'importe', label: 'Importe' }, { key: 'estado', label: 'Estado' }, { key: 'generado_at', label: 'Generado' }, { key: 'autorizado_at', label: 'Autorizado' }, { key: 'pagado_at', label: 'Pagado' }, { key: 'referencia_pago', label: 'Referencia' },
        ])}><Download className="h-4 w-4" /> Excel</button>
      </div>
      <ErrorMsg error={error} />
      {sel.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-navy-800 px-4 py-3 text-white shadow-lg">
          <span className="text-sm">{sel.size} seleccionados · <b>{money2(totalSel)}</b></span>
          {estado === 'pendiente' && puede('destajos.autorizar') && <button className="btn btn-success btn-sm" onClick={autorizar}>Autorizar pago</button>}
          {estado === 'autorizado' && puede('destajos.pagar') && <button className="btn btn-primary btn-sm" onClick={pagar}>Registrar pago</button>}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3" pad={false}>
          {rows.length === 0 ? <Empty>Sin destajos en este estado</Empty> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th className="w-8">{['pendiente', 'autorizado'].includes(estado) && <input type="checkbox" checked={sel.size === rows.length} onChange={e => setSel(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} />}</th><th>Técnico</th><th>Orden</th><th>Actividad</th><th>Estado</th><th>Fechas</th><th className="text-right">Importe</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <td>{['pendiente', 'autorizado'].includes(r.estado) && <input type="checkbox" checked={sel.has(r.id)} onChange={e => { const s = new Set(sel); if (e.target.checked) s.add(r.id); else s.delete(r.id); setSel(s) }} />}</td>
                  <td className="font-medium">{r.tecnicos?.nombre}</td>
                  <td><Link className="text-brand-700 hover:underline" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.ordenes?.folio}</Link></td>
                  <td>{r.actividades?.actividad}<div className="text-xs text-slate-500">{AREAS[r.actividades?.area ?? '']}{r.actividades?.pieza && ` · ${r.actividades.pieza}`}</div></td>
                  <td><Badge cls={ESTADO_DESTAJO[r.estado].badge}>{ESTADO_DESTAJO[r.estado].label}</Badge>{r.referencia_pago && <div className="text-[11px] text-slate-500">Ref. {r.referencia_pago}</div>}</td>
                  <td className="text-xs text-slate-500">Gen. {fecha(r.generado_at)}{r.autorizado_at && <><br />Aut. {fecha(r.autorizado_at)}</>}{r.pagado_at && <><br />Pag. {fecha(r.pagado_at)}</>}</td>
                  <td className="text-right font-semibold">{money2(r.importe)}
                    {r.estado !== 'cancelado' && puede('excepciones.autorizar') && <button className="ml-2 text-xs font-normal text-red-600 hover:underline" onClick={async () => {
                      const x = await revertir('destajo_cancelar', { p_id: r.id }, `¿Cancelar el destajo de ${r.tecnicos?.nombre} por ${money2(r.importe)}${r.estado === 'pagado' ? ' (YA PAGADO)' : ''}?`)
                      if (x !== undefined) { setError(x); cargar() }
                    }}>Cancelar</button>}</td>
                </tr>))}
              </tbody>
            </table></div>
          )}
        </Card>
        <Card title="Por técnico">
          {porTecnico.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
            <ul className="space-y-2 text-sm">{porTecnico.map(t => <li key={t.nombre} className="flex justify-between"><span>{t.nombre} <span className="text-xs text-slate-400">({t.n})</span></span><b>{money2(t.total)}</b></li>)}
              <li className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{money2(rows.reduce((s, r) => s + Number(r.importe), 0))}</span></li>
            </ul>
          )}
        </Card>
      </div>
      <p className="text-xs text-slate-500">Los destajos solo se generan al validar un trabajo terminado con evidencia. Un trabajo genera un único destajo y un destajo solo puede pagarse una vez, después de autorizado. Los de aseguradora y particulares se consultan por separado.</p>
    </div>
  )
}

interface ActProd { tecnico_id: number; orden_id: number; estado: string; horas: number | null; rechazos: number; importe_destajo: number; fecha_asignacion: string; validado_at: string | null; tecnicos?: { nombre: string } }

export function Productividad() {
  const per = usePeriodo('mes')
  const [rows, setRows] = useState<ActProd[]>([])
  useEffect(() => {
    supabase.from('actividades').select('tecnico_id, orden_id, estado, horas, rechazos, importe_destajo, fecha_asignacion, validado_at, tecnicos(nombre)')
      .gte('fecha_asignacion', per.desde).lt('fecha_asignacion', per.hasta).neq('estado', 'cancelada')
      .then(({ data }) => setRows((data ?? []) as unknown as ActProd[]))
  }, [per.desde, per.hasta])
  const stats = useMemo(() => {
    const m = new Map<number, { nombre: string; asignados: number; terminados: number; validados: number; pendientes: number; horas: number; nh: number; ordenes: Set<number>; destajo: number; retrabajos: number }>()
    for (const r of rows) {
      const s = m.get(r.tecnico_id) ?? { nombre: r.tecnicos?.nombre ?? '', asignados: 0, terminados: 0, validados: 0, pendientes: 0, horas: 0, nh: 0, ordenes: new Set<number>(), destajo: 0, retrabajos: 0 }
      s.asignados++; s.ordenes.add(r.orden_id); s.retrabajos += r.rechazos
      if (['terminada', 'validada'].includes(r.estado)) s.terminados++
      if (r.estado === 'validada') { s.validados++; s.destajo += Number(r.importe_destajo) }
      if (['asignada', 'en_proceso'].includes(r.estado)) s.pendientes++
      if (r.horas != null) { s.horas += Number(r.horas); s.nh++ }
      m.set(r.tecnico_id, s)
    }
    return [...m.values()].sort((a, b) => b.validados - a.validados)
  }, [rows])
  return (
    <Card title="Productividad por técnico" action={<PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />}>
      {stats.length === 0 ? <Empty>Sin trabajos asignados en el periodo</Empty> : (
        <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
          <thead><tr><th>Técnico</th><th className="text-right">Asignados</th><th className="text-right">Terminados</th><th className="text-right">Validados</th><th className="text-right">Pendientes</th><th className="text-right">Tiempo prom. (h)</th><th className="text-right">Vehículos</th><th className="text-right">Retrabajos</th><th className="text-right">Destajos generados</th></tr></thead>
          <tbody>{stats.map(s => (
            <tr key={s.nombre}><td className="font-medium">{s.nombre}</td><td className="text-right">{s.asignados}</td><td className="text-right">{s.terminados}</td><td className="text-right">{s.validados}</td>
              <td className="text-right">{s.pendientes}</td><td className="text-right">{s.nh ? num(s.horas / s.nh, 1) : '—'}</td><td className="text-right">{s.ordenes.size}</td>
              <td className={`text-right ${s.retrabajos ? 'font-semibold text-red-600' : ''}`}>{s.retrabajos}</td><td className="text-right font-semibold">{money2(s.destajo)}</td></tr>))}
          </tbody>
        </table></div>
      )}
      <p className="mt-3 text-xs text-slate-400">Periodo por fecha de asignación del trabajo. Retrabajos = veces que el supervisor rechazó un trabajo terminado.</p>
    </Card>
  )
}

export function TecnicosTarifas() {
  const { puede } = useAuth()
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([])
  const vacioTec = { nombre: '', area: 'hojalateria', perfil_id: '', especialidad: '', telefono: '' }
  const [ft, setFt] = useState(vacioTec)
  const [editando, setEditando] = useState<Tecnico | null>(null)
  const [fa, setFa] = useState({ area: 'hojalateria', actividad: '', importe: '' })
  const [error, setError] = useState<string | null>(null)
  const editar = puede('config.gestionar')

  const cargar = useCallback(async () => {
    const [t, a, u] = await Promise.all([
      supabase.from('tecnicos').select('*').order('nombre'),
      supabase.from('tarifas_destajo').select('*').order('area').order('actividad'),
      supabase.from('perfiles').select('id,nombre,rol').eq('activo', true).order('nombre'),
    ])
    setTecnicos((t.data ?? []) as Tecnico[]); setTarifas((a.data ?? []) as Tarifa[])
    setUsuarios(((u.data ?? []) as { id: string; nombre: string; rol: string }[]).sort((x, y) => Number(y.rol === 'tecnico') - Number(x.rol === 'tecnico')).map(x => ({ id: x.id, nombre: x.rol === 'tecnico' ? x.nombre : `${x.nombre} (${ROLES[x.rol] ?? x.rol})` })))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function run(p: PromiseLike<{ error: unknown }>, reset?: () => void) {
    const { error } = await p
    setError(error ? errorTexto(error) : null)
    if (!error) { reset?.(); cargar() }
  }
  const altaTec = (e: FormEvent) => {
    e.preventDefault()
    const datos = { nombre: ft.nombre.trim().toUpperCase(), area: ft.area, perfil_id: ft.perfil_id || null, especialidad: ft.especialidad.trim() || null, telefono: ft.telefono.trim() || null }
    if (editando) {
      if (editando.area !== ft.area && !confirm(`¿Cambiar el área de ${editando.nombre.trim()} a ${AREAS[ft.area]}? Sus trabajos ya registrados conservan su área.`)) return
      run(supabase.from('tecnicos').update(datos).eq('id', editando.id), () => { setEditando(null); setFt(vacioTec) })
    } else run(supabase.from('tecnicos').insert(datos), () => setFt({ ...vacioTec, area: ft.area }))
  }
  function empezarEdicion(t: Tecnico) {
    setEditando(t); setError(null)
    setFt({ nombre: t.nombre.trim(), area: t.area, perfil_id: t.perfil_id ?? '', especialidad: t.especialidad ?? '', telefono: t.telefono ?? '' })
    setTimeout(() => document.getElementById('form-tecnico')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const altaTar = (e: FormEvent) => { e.preventDefault(); run(supabase.from('tarifas_destajo').insert(fa), () => setFa({ ...fa, actividad: '', importe: '' })) }
  async function cambiarImporte(t: Tarifa) {
    const v = prompt(`Nuevo importe para "${t.actividad}" (actual ${money2(t.importe)}). Aplica a trabajos que se asignen a partir de ahora:`, String(t.importe))
    if (v === null) return
    run(supabase.from('tarifas_destajo').update({ importe: Number(v) }).eq('id', t.id))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ErrorMsg error={error} />
      <Card title="Técnicos" className="lg:col-start-1" action={<a href={`${import.meta.env.BASE_URL}tecnicos/`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Smartphone className="h-4 w-4" /> App de técnicos</a>}>
        {tecnicos.length === 0 ? <Empty>Sin técnicos</Empty> : (
          <ul className="divide-y text-sm">{tecnicos.map(t => (
            <li key={t.id} className={`flex items-center justify-between gap-3 py-2 ${t.activo ? '' : 'opacity-50'} ${editando?.id === t.id ? 'rounded-lg bg-brand-50 px-2 ring-1 ring-brand-300' : ''}`}>
              <span><b>{t.nombre.trim()}</b> · {AREAS[t.area]}{t.especialidad && ` · ${t.especialidad}`}{t.telefono && <span className="text-slate-500"> · {t.telefono}</span>} {t.perfil_id && <Badge cls="bg-blue-50 text-blue-700">con usuario</Badge>}</span>
              {editar && <span className="flex shrink-0 items-center gap-3">
                <button className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline" onClick={() => empezarEdicion(t)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                <button className="text-xs text-slate-500 hover:underline" onClick={() => run(supabase.from('tecnicos').update({ activo: !t.activo }).eq('id', t.id))}>{t.activo ? 'Desactivar' : 'Activar'}</button>
              </span>}
            </li>))}
          </ul>
        )}
        {editar && (
          <form id="form-tecnico" onSubmit={altaTec} className={`mt-3 grid gap-2 rounded-xl p-3 sm:grid-cols-2 ${editando ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-slate-50'}`}>
            {editando && <div className="text-sm font-bold text-brand-800 sm:col-span-2">Editando a {editando.nombre.trim()}</div>}
            <Field label="Nombre *"><input className="input" required value={ft.nombre} onChange={e => setFt({ ...ft, nombre: e.target.value })} /></Field>
            <Field label="Especialidad"><input className="input" value={ft.especialidad} onChange={e => setFt({ ...ft, especialidad: e.target.value })} placeholder="Ej. Pintor preparador, hojalatero" /></Field>
            <Field label="Teléfono"><input className="input" type="tel" value={ft.telefono} onChange={e => setFt({ ...ft, telefono: e.target.value })} /></Field>
            <Field label="Área"><select className="input" value={ft.area} onChange={e => setFt({ ...ft, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Usuario del sistema (opcional)" className="sm:col-span-2" hint="Vincúlalo para que el técnico vea y avance sus propios trabajos">
              <select className="input" value={ft.perfil_id} onChange={e => setFt({ ...ft, perfil_id: e.target.value })}><option value="">Sin usuario</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
            </Field>
            {editando ? (
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => { setEditando(null); setFt(vacioTec) }}>Cancelar</button>
                <button className="btn btn-primary flex-1"><Save className="h-4 w-4" /> Guardar cambios</button>
              </div>
            ) : <button className="btn btn-primary sm:col-span-2"><Plus className="h-4 w-4" /> Agregar técnico</button>}
          </form>
        )}
      </Card>
      <Card title="Tarifas de destajo">
        {tarifas.length === 0 ? <Empty>Sin tarifas configuradas. Sin tarifa, los trabajos no generan destajo.</Empty> : (
          <ul className="divide-y text-sm">{tarifas.map(t => (
            <li key={t.id} className={`flex items-center justify-between gap-2 py-2 ${t.activo ? '' : 'opacity-50'}`}>
              <span><span className="text-xs text-slate-500">{AREAS[t.area]}</span> · <b>{t.actividad}</b></span>
              <span className="flex items-center gap-3">
                <b>{money2(t.importe)}</b>
                {editar && <><button className="text-xs text-brand-700 hover:underline" onClick={() => cambiarImporte(t)}>Cambiar</button>
                  <button className="text-xs text-slate-500 hover:underline" onClick={() => run(supabase.from('tarifas_destajo').update({ activo: !t.activo }).eq('id', t.id))}>{t.activo ? 'Desactivar' : 'Activar'}</button></>}
              </span>
            </li>))}
          </ul>
        )}
        {editar && (
          <form onSubmit={altaTar} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[9rem_1fr_7rem_auto]">
            <Field label="Área"><select className="input" value={fa.area} onChange={e => setFa({ ...fa, area: e.target.value })}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Actividad *"><input className="input" required value={fa.actividad} onChange={e => setFa({ ...fa, actividad: e.target.value })} placeholder="Ej. Reparación de defensa" /></Field>
            <Field label="Importe *"><input className="input" type="number" step="0.01" min="0" required value={fa.importe} onChange={e => setFa({ ...fa, importe: e.target.value })} /></Field>
            <button className="btn btn-primary self-end"><Plus className="h-4 w-4" /></button>
          </form>
        )}
        <p className="mt-2 text-xs text-slate-400">Los cambios de tarifa quedan en auditoría y no modifican trabajos ya terminados.</p>
      </Card>
    </div>
  )
}
