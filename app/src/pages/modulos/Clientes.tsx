import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Car, Download, MessageSquare, Plus, Shield, Star, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { clean, errorTexto, fecha, fechaHora, limpiaBusqueda } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import { Badge, Card, Empty, ErrorMsg, Field, Modal, PageHeader, Tabs, useTab } from '../../components/ui'

export interface Cliente {
  id: number; tipo: string; nombre: string; telefono: string | null; email: string | null; direccion: string | null
  rfc: string | null; razon_social: string | null; regimen_fiscal: string | null; cp_fiscal: string | null; uso_cfdi: string | null
  dias_credito: number; notas: string | null; created_at: string
}
export interface Vehiculo { id: number; cliente_id: number | null; marca: string; modelo: string; anio: number | null; placas: string | null; vin: string | null; color: string | null; notas: string | null }

export const TIPOS_SEGUIMIENTO: Record<string, string> = { llamada: 'Llamada', whatsapp: 'WhatsApp', correo: 'Correo', visita: 'Visita', cita: 'Cita', encuesta: 'Encuesta', otro: 'Otro' }

/* ------------------------------ FORMULARIOS ------------------------------ */
export function ClienteForm({ c, onDone }: { c: Cliente | null; onDone: (id?: number) => void }) {
  const [f, setF] = useState({
    tipo: c?.tipo ?? 'persona', nombre: c?.nombre ?? '', telefono: c?.telefono ?? '', email: c?.email ?? '', direccion: c?.direccion ?? '',
    rfc: c?.rfc ?? '', razon_social: c?.razon_social ?? '', regimen_fiscal: c?.regimen_fiscal ?? '', cp_fiscal: c?.cp_fiscal ?? '',
    uso_cfdi: c?.uso_cfdi ?? '', dias_credito: String(c?.dias_credito ?? 0), notas: c?.notas ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = clean({ ...f, rfc: f.rfc.toUpperCase().trim() })
    const r = c ? await supabase.from('clientes').update(d).eq('id', c.id).select('id').single() : await supabase.from('clientes').insert(d).select('id').single()
    if (r.error) return setError(errorTexto(r.error))
    onDone(r.data.id)
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
      <Field label="Tipo"><select className="input" value={f.tipo} onChange={set('tipo')}><option value="persona">Persona física</option><option value="empresa">Empresa</option></select></Field>
      <Field label="Nombre *"><input className="input" required value={f.nombre} onChange={set('nombre')} /></Field>
      <Field label="Teléfono"><input className="input" type="tel" value={f.telefono} onChange={set('telefono')} /></Field>
      <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
      <Field label="Dirección" className="sm:col-span-2"><input className="input" value={f.direccion} onChange={set('direccion')} /></Field>
      <div className="border-t pt-3 text-sm font-semibold sm:col-span-2">Datos fiscales <span className="font-normal text-slate-400">(preparados para CFDI 4.0)</span></div>
      <Field label="RFC"><input className="input uppercase" value={f.rfc} onChange={set('rfc')} /></Field>
      <Field label="Razón social"><input className="input" value={f.razon_social} onChange={set('razon_social')} /></Field>
      <Field label="Régimen fiscal"><input className="input" list="regimenes" value={f.regimen_fiscal} onChange={set('regimen_fiscal')} placeholder="Ej. 612" /></Field>
      <Field label="C.P. fiscal"><input className="input" value={f.cp_fiscal} onChange={set('cp_fiscal')} /></Field>
      <Field label="Uso de CFDI"><input className="input" list="usos" value={f.uso_cfdi} onChange={set('uso_cfdi')} placeholder="Ej. G03" /></Field>
      <Field label="Días de crédito"><input className="input" type="number" min={0} value={f.dias_credito} onChange={set('dias_credito')} /></Field>
      <Field label="Notas" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notas} onChange={set('notas')} /></Field>
      <datalist id="regimenes">{[['601', 'General de Ley PM'], ['603', 'PM con fines no lucrativos'], ['605', 'Sueldos y salarios'], ['612', 'Act. empresariales y profesionales'], ['616', 'Sin obligaciones fiscales'], ['626', 'RESICO']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
      <datalist id="usos">{[['G03', 'Gastos en general'], ['S01', 'Sin efectos fiscales'], ['G01', 'Adquisición de mercancías']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-secondary" onClick={() => onDone()}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
    </form>
  )
}

export function VehiculoForm({ v, clienteId, onDone }: { v: Vehiculo | null; clienteId?: number; onDone: () => void }) {
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([])
  const [f, setF] = useState({ cliente_id: String(v?.cliente_id ?? clienteId ?? ''), marca: v?.marca ?? '', modelo: v?.modelo ?? '', anio: String(v?.anio ?? ''), placas: v?.placas ?? '', vin: v?.vin ?? '', color: v?.color ?? '', notas: v?.notas ?? '' })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { if (!clienteId) supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data ?? [])) }, [clienteId])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = clean({ ...f, placas: f.placas.toUpperCase().trim(), vin: f.vin.toUpperCase().trim() })
    const { error } = v ? await supabase.from('vehiculos').update(d).eq('id', v.id) : await supabase.from('vehiculos').insert(d)
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3"><ErrorMsg error={error} /></div>
      {!clienteId && <Field label="Propietario *" className="sm:col-span-3"><select className="input" required value={f.cliente_id} onChange={set('cliente_id')}><option value="">Selecciona…</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>}
      <Field label="Marca *"><input className="input" required value={f.marca} onChange={set('marca')} /></Field>
      <Field label="Modelo *"><input className="input" required value={f.modelo} onChange={set('modelo')} /></Field>
      <Field label="Año"><input className="input" type="number" min={1950} max={2100} value={f.anio} onChange={set('anio')} /></Field>
      <Field label="Placas"><input className="input uppercase" value={f.placas} onChange={set('placas')} /></Field>
      <Field label="Color"><input className="input" value={f.color} onChange={set('color')} /></Field>
      <Field label="VIN"><input className="input uppercase" value={f.vin} onChange={set('vin')} /></Field>
      <Field label="Notas" className="sm:col-span-3"><input className="input" value={f.notas} onChange={set('notas')} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-3"><button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
    </form>
  )
}

/* ------------------------------ CLIENTES ------------------------------ */
function ListaClientes() {
  const { puede } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<(Cliente & { vehiculos: { count: number }[]; ordenes: { count: number }[] })[]>([])
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const cargar = useCallback(async () => {
    let query = supabase.from('clientes').select('*, vehiculos(count), ordenes(count)').order('nombre').limit(500)
    const s = limpiaBusqueda(q)
    if (s) query = query.or(['nombre', 'telefono', 'email', 'rfc'].map(c => `${c}.ilike.%${s}%`).join(','))
    const { data } = await query
    setRows((data ?? []) as typeof rows)
  }, [q])
  useEffect(() => { const t = setTimeout(cargar, 200); return () => clearTimeout(t) }, [cargar])
  const editar = puede('ordenes.gestionar') || puede('asignaciones.gestionar')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-72" placeholder="Nombre, teléfono, correo o RFC…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('clientes', rows as unknown as Record<string, unknown>[], [
          { key: 'nombre', label: 'Nombre' }, { key: 'tipo', label: 'Tipo' }, { key: 'telefono', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'rfc', label: 'RFC' },
          { key: 'razon_social', label: 'Razón social' }, { key: 'regimen_fiscal', label: 'Régimen' }, { key: 'cp_fiscal', label: 'CP fiscal' }, { key: 'dias_credito', label: 'Días crédito' }])}><Download className="h-4 w-4" /> Excel</button>
        {editar && <button className="btn btn-primary btn-sm" onClick={() => setNuevo(true)}><Plus className="h-4 w-4" /> Nuevo cliente</button>}
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Users}>Sin clientes. También se dan de alta automáticamente al recibir un vehículo.</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Nombre</th><th>Contacto</th><th>RFC</th><th className="text-right">Vehículos</th><th className="text-right">Órdenes</th><th className="text-right">Crédito</th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/clientes/${c.id}`)}>
                <td className="font-medium text-blue-600">{c.nombre}<div className="text-xs font-normal text-slate-500">{c.tipo === 'empresa' ? 'Empresa' : 'Persona física'}</div></td>
                <td>{c.telefono ?? '—'}<div className="text-xs text-slate-500">{c.email}</div></td>
                <td className="font-mono text-xs">{c.rfc ?? '—'}</td>
                <td className="text-right">{c.vehiculos?.[0]?.count ?? 0}</td><td className="text-right">{c.ordenes?.[0]?.count ?? 0}</td>
                <td className="text-right">{c.dias_credito ? `${c.dias_credito} días` : 'Contado'}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {nuevo && <Modal title="Nuevo cliente" onClose={() => setNuevo(false)} wide><ClienteForm c={null} onDone={id => { setNuevo(false); if (id) nav(`/clientes/${id}`) }} /></Modal>}
    </div>
  )
}

/* ------------------------------ ASEGURADORAS ------------------------------ */
interface Aseguradora { id: number; nombre: string; activo: boolean; razon_social: string | null; rfc: string | null; contacto: string | null; telefono: string | null; email: string | null; dias_credito: number; dias_contacto: number; condiciones: string | null }
interface TipoRep { id: number; nombre: string; dias_objetivo: number; activo: boolean; aseguradora_id: number | null }

function Aseguradoras() {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Aseguradora[]>([])
  const [tipos, setTipos] = useState<TipoRep[]>([])
  const [conteo, setConteo] = useState<Record<number, number>>({})
  const [edit, setEdit] = useState<Aseguradora | 'nueva' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const config = puede('config.gestionar')
  const cargar = useCallback(() => {
    supabase.from('aseguradoras').select('*').order('activo', { ascending: false }).order('nombre').then(({ data }) => setRows((data ?? []) as Aseguradora[]))
    supabase.from('tipos_reparacion').select('*').order('dias_objetivo').then(({ data }) => setTipos((data ?? []) as TipoRep[]))
    supabase.from('ordenes').select('aseguradora_id').not('aseguradora_id', 'is', null).then(({ data }) => {
      const c: Record<number, number> = {}; for (const o of data ?? []) c[o.aseguradora_id!] = (c[o.aseguradora_id!] ?? 0) + 1; setConteo(c)
    })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  function Formulario({ a }: { a: Aseguradora | null }) {
    const [f, setF] = useState({ nombre: a?.nombre ?? '', razon_social: a?.razon_social ?? '', rfc: a?.rfc ?? '', contacto: a?.contacto ?? '', telefono: a?.telefono ?? '', email: a?.email ?? '', dias_credito: String(a?.dias_credito ?? 30), dias_contacto: String(a?.dias_contacto ?? 1), condiciones: a?.condiciones ?? '' })
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
    async function submit(e: FormEvent) {
      e.preventDefault()
      const d = clean({ ...f, rfc: f.rfc.toUpperCase().trim() })
      // Las aseguradoras nuevas se crean deshabilitadas hasta que exista autorización para operar con ellas
      const { error } = a ? await supabase.from('aseguradoras').update(d).eq('id', a.id) : await supabase.from('aseguradoras').insert({ ...d, activo: false })
      if (error) return setError(errorTexto(error))
      setEdit(null); cargar()
    }
    return (
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre comercial *"><input className="input" required value={f.nombre} onChange={set('nombre')} /></Field>
        <Field label="Razón social"><input className="input" value={f.razon_social} onChange={set('razon_social')} /></Field>
        <Field label="RFC"><input className="input uppercase" value={f.rfc} onChange={set('rfc')} /></Field>
        <Field label="Contacto (ajustador / valuador)"><input className="input" value={f.contacto} onChange={set('contacto')} /></Field>
        <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set('telefono')} /></Field>
        <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Días de crédito (pago de facturas)"><input className="input" type="number" min={0} value={f.dias_credito} onChange={set('dias_credito')} /></Field>
        <Field label="Plazo para contactar al asegurado (días)"><input className="input" type="number" min={0} value={f.dias_contacto} onChange={set('dias_contacto')} /></Field>
        <Field label="Convenio / condiciones comerciales" className="sm:col-span-2"><textarea className="input" rows={3} value={f.condiciones} onChange={set('condiciones')} placeholder="Ej. Tarifa de mano de obra, % de descuento en refacciones, penalizaciones por retraso…" /></Field>
        {!a && <p className="text-xs text-amber-700 sm:col-span-2">La aseguradora se crea deshabilitada. Habilítala solo cuando exista un convenio autorizado.</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
      </form>
    )
  }

  async function alternar(a: Aseguradora) {
    if (!confirm(a.activo ? `¿Deshabilitar ${a.nombre}? No se podrán registrar nuevas asignaciones ni órdenes con ella.` : `¿Habilitar ${a.nombre} para operar? Confirma que existe un convenio autorizado.`)) return
    const { error } = await supabase.from('aseguradoras').update({ activo: !a.activo }).eq('id', a.id)
    setError(error ? errorTexto(error) : null); cargar()
  }
  async function cambiarPlazo(t: TipoRep, dias: number) {
    const { error } = await supabase.from('tipos_reparacion').update({ dias_objetivo: dias }).eq('id', t.id)
    setError(error ? errorTexto(error) : null); cargar()
  }
  async function agregarPlazo(a: Aseguradora, nombre: string, dias: number) {
    const { error } = await supabase.from('tipos_reparacion').insert({ nombre, dias_objetivo: dias, aseguradora_id: a.id })
    setError(error ? errorTexto(error) : null); cargar()
  }

  return (
    <div className="space-y-4">
      <ErrorMsg error={error} />
      {config && <div className="flex justify-end"><button className="btn btn-primary btn-sm" onClick={() => setEdit('nueva')}><Plus className="h-4 w-4" /> Nueva aseguradora</button></div>}
      {rows.map(a => (
        <Card key={a.id} title={<span className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /> {a.nombre} <Badge cls={a.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>{a.activo ? 'Habilitada' : 'Deshabilitada'}</Badge></span>}
          action={config && <div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => setEdit(a)}>Editar</button><button className="btn btn-ghost btn-sm" onClick={() => alternar(a)}>{a.activo ? 'Deshabilitar' : 'Habilitar'}</button></div>}>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <dl className="space-y-1">
              <div><dt className="inline text-slate-500">Razón social: </dt><dd className="inline">{a.razon_social ?? '—'}</dd></div>
              <div><dt className="inline text-slate-500">RFC: </dt><dd className="inline font-mono">{a.rfc ?? '—'}</dd></div>
              <div><dt className="inline text-slate-500">Contacto: </dt><dd className="inline">{a.contacto ?? '—'} {a.telefono && `· ${a.telefono}`}</dd></div>
              <div><dt className="inline text-slate-500">Órdenes registradas: </dt><dd className="inline font-semibold">{conteo[a.id] ?? 0}</dd></div>
            </dl>
            <dl className="space-y-1">
              <div><dt className="inline text-slate-500">Crédito: </dt><dd className="inline font-semibold">{a.dias_credito} días</dd></div>
              <div><dt className="inline text-slate-500">Contactar al asegurado en: </dt><dd className="inline font-semibold">{a.dias_contacto} día(s)</dd></div>
              <div className="text-slate-500">Convenio:</div><div className="whitespace-pre-wrap">{a.condiciones ?? 'Sin condiciones registradas'}</div>
            </dl>
            <div>
              <div className="mb-1 text-slate-500">Plazos de reparación (fecha compromiso)</div>
              <ul className="space-y-1">{tipos.filter(t => t.aseguradora_id === a.id).map(t => (
                <li key={t.id} className="flex items-center justify-between gap-2"><span>{t.nombre}</span>
                  <span className="flex items-center gap-1"><input className="input w-16 py-1 text-right" type="number" min={1} defaultValue={t.dias_objetivo} disabled={!config} onBlur={e => Number(e.target.value) !== t.dias_objetivo && cambiarPlazo(t, Number(e.target.value))} /> días</span></li>))}
              </ul>
              {config && <form className="mt-2 flex gap-1" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); agregarPlazo(a, String(fd.get('n')), Number(fd.get('d'))); e.currentTarget.reset() }}>
                <input name="n" className="input py-1" required placeholder="Tipo de reparación" /><input name="d" className="input w-16 py-1" type="number" min={1} required placeholder="Días" /><button className="btn btn-secondary btn-sm">+</button>
              </form>}
            </div>
          </div>
        </Card>
      ))}
      <Card title="Plazos para servicios particulares">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">{tipos.filter(t => t.aseguradora_id === null).map(t => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span>{t.nombre}</span>
            <span className="flex items-center gap-1"><input className="input w-16 py-1 text-right" type="number" min={1} defaultValue={t.dias_objetivo} disabled={!config} onBlur={e => Number(e.target.value) !== t.dias_objetivo && cambiarPlazo(t, Number(e.target.value))} /> días</span></li>))}
        </ul>
      </Card>
      {edit && <Modal title={edit === 'nueva' ? 'Nueva aseguradora' : `Editar ${edit.nombre}`} onClose={() => setEdit(null)} wide><Formulario a={edit === 'nueva' ? null : edit} /></Modal>}
    </div>
  )
}

/* ------------------------------ VEHÍCULOS ------------------------------ */
function Vehiculos() {
  const { puede } = useAuth()
  const [rows, setRows] = useState<(Vehiculo & { clientes: { nombre: string } | null; ordenes: { id: number; folio: string; etapa: string; fecha_ingreso: string }[] })[]>([])
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Vehiculo | 'nuevo' | null>(null)
  const [hist, setHist] = useState<(typeof rows)[number] | null>(null)
  const cargar = useCallback(async () => {
    let query = supabase.from('vehiculos').select('*, clientes(nombre), ordenes(id, folio, etapa, fecha_ingreso)').order('created_at', { ascending: false }).limit(500)
    const s = limpiaBusqueda(q)
    if (s) query = query.or(['placas', 'marca', 'modelo', 'vin'].map(c => `${c}.ilike.%${s}%`).join(','))
    const { data } = await query
    setRows((data ?? []) as typeof rows)
  }, [q])
  useEffect(() => { const t = setTimeout(cargar, 200); return () => clearTimeout(t) }, [cargar])
  const editar = puede('ordenes.gestionar') || puede('asignaciones.gestionar')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-72" placeholder="Placas, marca, modelo o VIN…" value={q} onChange={e => setQ(e.target.value)} />
        {editar && <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEdit('nuevo')}><Plus className="h-4 w-4" /> Nuevo vehículo</button>}
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Car}>Sin vehículos registrados</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Placas</th><th>Vehículo</th><th>Propietario</th><th className="text-right">Servicios</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody>{rows.map(v => {
              const ult = [...(v.ordenes ?? [])].sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso))[0]
              return (
                <tr key={v.id}>
                  <td className="font-mono font-semibold">{v.placas ?? '—'}</td>
                  <td>{v.marca} {v.modelo} {v.anio}<div className="text-xs text-slate-500">{v.color}{v.vin && ` · ${v.vin}`}</div></td>
                  <td>{v.cliente_id ? <Link className="text-blue-600 hover:underline" to={`/clientes/${v.cliente_id}`}>{v.clientes?.nombre}</Link> : '—'}</td>
                  <td className="text-right">{v.ordenes?.length ?? 0}</td>
                  <td>{ult ? <Link className="text-blue-600 hover:underline" to={`/ordenes/${ult.id}`}>{ult.folio}</Link> : '—'} {ult && <span className="text-xs text-slate-500">{fecha(ult.fecha_ingreso)}</span>}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn btn-secondary btn-sm" onClick={() => setHist(v)}>Historial</button>{' '}
                    {editar && <button className="btn btn-secondary btn-sm" onClick={() => setEdit(v)}>Editar</button>}
                  </td>
                </tr>)
            })}</tbody>
          </table></div>
        )}
      </Card>
      {edit && <Modal title={edit === 'nuevo' ? 'Nuevo vehículo' : 'Editar vehículo'} onClose={() => setEdit(null)} wide><VehiculoForm v={edit === 'nuevo' ? null : edit} onDone={() => { setEdit(null); cargar() }} /></Modal>}
      {hist && <Modal title={`Historial · ${hist.marca} ${hist.modelo} ${hist.placas ?? ''}`} onClose={() => setHist(null)}>
        {!hist.ordenes?.length ? <p className="text-sm text-slate-500">Sin servicios registrados</p> : (
          <ul className="divide-y text-sm">{[...hist.ordenes].sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso)).map(o => (
            <li key={o.id} className="flex justify-between py-2"><Link className="font-semibold text-blue-600" to={`/ordenes/${o.id}`}>{o.folio}</Link><span className="text-slate-500">{fecha(o.fecha_ingreso)}</span></li>))}
          </ul>
        )}
      </Modal>}
    </div>
  )
}

/* ------------------------------ SEGUIMIENTO Y ENCUESTAS ------------------------------ */
interface Seg { id: number; cliente_id: number; orden_id: number | null; fecha: string; tipo: string; fecha_cita: string | null; notas: string; clientes?: { nombre: string; telefono: string | null }; perfiles?: { nombre: string } | null }

function Seguimiento() {
  const [proximas, setProximas] = useState<Seg[]>([])
  const [recientes, setRecientes] = useState<Seg[]>([])
  useEffect(() => {
    supabase.from('cliente_seguimientos').select('*, clientes(nombre, telefono), perfiles(nombre)').gte('fecha_cita', new Date().toISOString()).order('fecha_cita').limit(50).then(({ data }) => setProximas((data ?? []) as Seg[]))
    supabase.from('cliente_seguimientos').select('*, clientes(nombre, telefono), perfiles(nombre)').order('fecha', { ascending: false }).limit(100).then(({ data }) => setRecientes((data ?? []) as Seg[]))
  }, [])
  const fila = (s: Seg, cita?: boolean) => (
    <li key={s.id} className="py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge cls="bg-slate-100 text-slate-700">{TIPOS_SEGUIMIENTO[s.tipo]}</Badge>
        <Link to={`/clientes/${s.cliente_id}?tab=seguimiento`} className="font-semibold text-blue-600 hover:underline">{s.clientes?.nombre}</Link>
        <span className="text-xs text-slate-500">{cita ? `Cita ${fechaHora(s.fecha_cita)}` : fechaHora(s.fecha)} · {s.perfiles?.nombre ?? ''}</span></div>
      <div className="text-slate-600">{s.notas}</div>
    </li>
  )
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Próximas citas y llamadas programadas">{proximas.length === 0 ? <Empty>Sin citas programadas</Empty> : <ul className="divide-y">{proximas.map(s => fila(s, true))}</ul>}</Card>
      <Card title="Seguimientos recientes">{recientes.length === 0 ? <Empty>Sin seguimientos. Se registran desde la ficha de cada cliente.</Empty> : <ul className="divide-y">{recientes.map(s => fila(s))}</ul>}</Card>
    </div>
  )
}

interface Enc { id: number; folio: string; cliente_id: number; cliente_nombre: string; fecha_entrega: string; satisfaccion: number | null; encuesta_comentario: string | null; aseguradora_nombre: string | null }
function Encuestas() {
  const [rows, setRows] = useState<Enc[]>([])
  useEffect(() => {
    supabase.from('v_ordenes').select('id, folio, cliente_id, cliente_nombre, fecha_entrega, satisfaccion, encuesta_comentario, aseguradora_nombre').eq('etapa', 'entregado').order('fecha_entrega', { ascending: false }).limit(300)
      .then(({ data }) => setRows((data ?? []) as Enc[]))
  }, [])
  const resp = rows.filter(r => r.satisfaccion)
  const prom = resp.length ? resp.reduce((s, r) => s + (r.satisfaccion ?? 0), 0) / resp.length : NaN
  const pend = rows.filter(r => !r.satisfaccion)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-4"><div className="text-xs text-slate-500">Satisfacción promedio</div><div className="flex items-center gap-1 text-2xl font-extrabold">{isNaN(prom) ? '—' : prom.toFixed(2)} <Star className="h-5 w-5 fill-amber-400 text-amber-400" /></div></div>
        <div className="card !p-4"><div className="text-xs text-slate-500">Encuestas respondidas</div><div className="text-2xl font-extrabold">{resp.length} / {rows.length}</div></div>
        <div className="card !p-4"><div className="text-xs text-slate-500">Pendientes de encuesta</div><div className={`text-2xl font-extrabold ${pend.length ? 'text-amber-600' : ''}`}>{pend.length}</div></div>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Star}>Sin vehículos entregados</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Orden</th><th>Cliente</th><th>Entrega</th><th>Calificación</th><th>Comentario</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}>
                <td><Link className="font-semibold text-blue-600" to={`/ordenes/${r.id}?tab=entrega`}>{r.folio}</Link><div className="text-xs text-slate-500">{r.aseguradora_nombre ?? 'Particular'}</div></td>
                <td><Link className="hover:underline" to={`/clientes/${r.cliente_id}`}>{r.cliente_nombre}</Link></td>
                <td>{fecha(r.fecha_entrega)}</td>
                <td>{r.satisfaccion ? '★'.repeat(r.satisfaccion) + '☆'.repeat(5 - r.satisfaccion) : <Link className="text-xs font-semibold text-amber-700 hover:underline" to={`/ordenes/${r.id}?tab=entrega`}>Registrar encuesta</Link>}</td>
                <td className="text-xs text-slate-600">{r.encuesta_comentario ?? ''}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

export default function Clientes() {
  const tab = useTab('clientes')
  return (
    <div>
      <PageHeader title="Clientes y aseguradoras" subtitle="Catálogo de clientes, convenios con aseguradoras, vehículos, seguimiento y satisfacción" />
      <Tabs tabs={[
        { id: 'clientes', label: 'Clientes', icon: Users },
        { id: 'aseguradoras', label: 'Aseguradoras', icon: Building2 },
        { id: 'vehiculos', label: 'Vehículos', icon: Car },
        { id: 'seguimiento', label: 'Llamadas y citas', icon: MessageSquare },
        { id: 'encuestas', label: 'Encuestas', icon: Star },
      ]} />
      {tab === 'clientes' && <ListaClientes />}
      {tab === 'aseguradoras' && <Aseguradoras />}
      {tab === 'vehiculos' && <Vehiculos />}
      {tab === 'seguimiento' && <Seguimiento />}
      {tab === 'encuestas' && <Encuestas />}
    </div>
  )
}
