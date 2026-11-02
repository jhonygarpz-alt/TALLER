import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Car, ClipboardList, MessageSquare, Phone, Plus, Receipt, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { errorTexto, fecha, fechaHora, money2 } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, Modal, SinPermiso, Tabs, useTab } from '../../components/ui'
import { EtapaBadge } from '../Inicio'
import { ClienteForm, TIPOS_SEGUIMIENTO, VehiculoForm, type Cliente, type Vehiculo } from './Clientes'

interface Seg { id: number; fecha: string; tipo: string; fecha_cita: string | null; notas: string; orden_id: number | null; perfiles?: { nombre: string } | null }
interface Cxc { id: number; folio: string; orden_folio: string; orden_id: number; fecha: string; fecha_vencimiento: string; receptor: string; monto: number; pagado: number; saldo: number; dias_vencido: number }

function Seguimiento({ clienteId, ordenes }: { clienteId: number; ordenes: VOrden[] }) {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Seg[]>([])
  const [f, setF] = useState({ tipo: 'llamada', notas: '', fecha_cita: '', orden_id: '' })
  const [error, setError] = useState<string | null>(null)
  const cargar = useCallback(() => supabase.from('cliente_seguimientos').select('*, perfiles(nombre)').eq('cliente_id', clienteId).order('fecha', { ascending: false }).then(({ data }) => setRows((data ?? []) as Seg[])), [clienteId])
  useEffect(() => { cargar() }, [cargar])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('cliente_seguimientos').insert({
      cliente_id: clienteId, tipo: f.tipo, notas: f.notas.trim(), orden_id: f.orden_id ? Number(f.orden_id) : null,
      fecha_cita: f.fecha_cita ? new Date(f.fecha_cita).toISOString() : null,
    })
    if (error) return setError(errorTexto(error))
    setF({ tipo: 'llamada', notas: '', fecha_cita: '', orden_id: '' }); setError(null); cargar()
  }
  const puedeRegistrar = puede('asignaciones.gestionar') || puede('ordenes.gestionar')
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card title="Historial de contacto" className="lg:col-span-3">
        {rows.length === 0 ? <Empty>Sin llamadas, mensajes ni citas registradas</Empty> : (
          <ol className="space-y-3 border-l-2 border-slate-200 pl-4 text-sm">{rows.map(s => (
            <li key={s.id}>
              <div className="flex flex-wrap items-center gap-2"><Badge cls="bg-slate-100 text-slate-700">{TIPOS_SEGUIMIENTO[s.tipo]}</Badge>
                <span className="text-xs text-slate-500">{fechaHora(s.fecha)} · {s.perfiles?.nombre ?? ''}</span>
                {s.orden_id && <Link className="text-xs text-blue-600" to={`/ordenes/${s.orden_id}`}>{ordenes.find(o => o.id === s.orden_id)?.folio ?? 'orden'}</Link>}</div>
              {s.fecha_cita && <div className="font-semibold text-purple-700">Cita: {fechaHora(s.fecha_cita)}</div>}
              <div className="whitespace-pre-wrap text-slate-700">{s.notas}</div>
            </li>))}
          </ol>
        )}
      </Card>
      {puedeRegistrar && (
        <Card title="Registrar contacto" className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-3">
            <ErrorMsg error={error} />
            <Field label="Tipo"><select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS_SEGUIMIENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {ordenes.length > 0 && <Field label="Orden relacionada"><select className="input" value={f.orden_id} onChange={e => setF({ ...f, orden_id: e.target.value })}><option value="">—</option>{ordenes.map(o => <option key={o.id} value={o.id}>{o.folio} · {o.marca} {o.modelo}</option>)}</select></Field>}
            <Field label={f.tipo === 'cita' ? 'Fecha y hora de la cita *' : 'Programar cita (opcional)'}><input className="input" type="datetime-local" required={f.tipo === 'cita'} value={f.fecha_cita} onChange={e => setF({ ...f, fecha_cita: e.target.value })} /></Field>
            <Field label="Notas *"><textarea className="input" rows={3} required value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Ej. Se le informó avance de pintura; recoge el viernes" /></Field>
            <button className="btn btn-primary w-full"><Plus className="h-4 w-4" /> Guardar</button>
          </form>
        </Card>
      )}
    </div>
  )
}

function EstadoCuenta({ clienteId }: { clienteId: number }) {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Cxc[]>([])
  useEffect(() => {
    if (puede('finanzas.ver')) supabase.from('v_cuentas_cobrar').select('*').eq('cliente_id', clienteId).eq('receptor', 'cliente').order('fecha').then(({ data }) => setRows((data ?? []) as Cxc[]))
  }, [clienteId, puede])
  if (!puede('finanzas.ver')) return <SinPermiso que="el estado de cuenta" />
  const saldo = rows.reduce((s, r) => s + Number(r.saldo), 0)
  return (
    <Card title="Estado de cuenta (facturas al cliente)" action={<span className={`text-lg font-extrabold ${saldo > 0 ? 'text-red-600' : 'text-green-700'}`}>Saldo {money2(saldo)}</span>}>
      {rows.length === 0 ? <Empty>Sin facturas a nombre del cliente</Empty> : (
        <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
          <thead><tr><th>Factura</th><th>Orden</th><th>Fecha</th><th>Vence</th><th className="text-right">Importe</th><th className="text-right">Pagado</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id}><td className="font-semibold">{r.folio}</td><td><Link className="text-blue-600" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.orden_folio}</Link></td>
              <td>{fecha(r.fecha)}</td><td className={r.saldo > 0 && r.dias_vencido > 0 ? 'font-semibold text-red-600' : ''}>{fecha(r.fecha_vencimiento)}{r.saldo > 0 && r.dias_vencido > 0 && ` (${r.dias_vencido} d)`}</td>
              <td className="text-right">{money2(r.monto)}</td><td className="text-right">{money2(r.pagado)}</td><td className="text-right font-semibold">{money2(r.saldo)}</td></tr>))}
          </tbody>
        </table></div>
      )}
    </Card>
  )
}

export default function ClienteDetalle() {
  const id = Number(useParams().id)
  const { puede } = useAuth()
  const tab = useTab('servicios')
  const [c, setC] = useState<Cliente | null>(null)
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [ordenes, setOrdenes] = useState<VOrden[]>([])
  const [modal, setModal] = useState<'cliente' | 'vehiculo' | Vehiculo | null>(null)
  const cargar = useCallback(async () => {
    const [a, b, d] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('vehiculos').select('*').eq('cliente_id', id).order('created_at'),
      supabase.from('v_ordenes').select('*').eq('cliente_id', id).order('fecha_ingreso', { ascending: false }),
    ])
    setC(a.data as Cliente); setVehiculos((b.data ?? []) as Vehiculo[]); setOrdenes((d.data ?? []) as VOrden[])
  }, [id])
  useEffect(() => { cargar() }, [cargar])
  if (!c) return <div className="text-slate-400">Cargando…</div>
  const editar = puede('ordenes.gestionar') || puede('asignaciones.gestionar')
  const encuestas = ordenes.filter(o => o.satisfaccion)

  return (
    <div>
      <Link to="/clientes" className="text-sm font-medium text-blue-600 hover:underline">← Clientes y aseguradoras</Link>
      <div className="card mt-2 mb-5 grid gap-4 md:grid-cols-3">
        <div className="flex items-start gap-3 md:col-span-2">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600"><User className="h-7 w-7" /></div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold">{c.nombre}</h1>
            <div className="text-sm text-slate-500">{c.tipo === 'empresa' ? 'Empresa' : 'Persona física'}{c.dias_credito ? ` · Crédito ${c.dias_credito} días` : ' · Contado'}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {c.telefono && <a className="inline-flex items-center gap-1 text-blue-600" href={`tel:${c.telefono}`}><Phone className="h-4 w-4" />{c.telefono}</a>}
              {c.email && <span className="text-slate-600">{c.email}</span>}
              {c.direccion && <span className="text-slate-600">{c.direccion}</span>}
            </div>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">Datos fiscales</div>
          <div>RFC: <span className="font-mono">{c.rfc ?? '—'}</span></div>
          <div>Razón social: {c.razon_social ?? '—'}</div>
          <div>Régimen {c.regimen_fiscal ?? '—'} · C.P. {c.cp_fiscal ?? '—'} · Uso {c.uso_cfdi ?? '—'}</div>
          {editar && <button className="btn btn-secondary btn-sm mt-2" onClick={() => setModal('cliente')}>Editar datos</button>}
        </div>
        {c.notas && <p className="text-sm text-slate-600 md:col-span-3">{c.notas}</p>}
      </div>

      <Tabs tabs={[
        { id: 'servicios', label: `Historial de servicios (${ordenes.length})`, icon: ClipboardList },
        { id: 'vehiculos', label: `Vehículos (${vehiculos.length})`, icon: Car },
        { id: 'seguimiento', label: 'Llamadas y citas', icon: MessageSquare },
        { id: 'cuenta', label: 'Estado de cuenta', icon: Receipt, hidden: !puede('finanzas.ver') },
      ]} />

      {tab === 'servicios' && (
        <Card pad={false}>
          {ordenes.length === 0 ? <Empty>Sin servicios</Empty> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Orden</th><th>Vehículo</th><th>Tipo</th><th>Estado</th><th>Ingreso</th><th>Entrega</th><th>Satisfacción</th></tr></thead>
              <tbody>{ordenes.map(o => (
                <tr key={o.id}><td><Link className="font-bold text-blue-600" to={`/ordenes/${o.id}`}>{o.folio}</Link></td>
                  <td>{o.marca} {o.modelo} <span className="text-xs text-slate-500">{o.placas}</span></td>
                  <td className="text-xs">{o.aseguradora_nombre ? `${o.aseguradora_nombre} · ${o.siniestro}` : 'Particular'}</td>
                  <td><EtapaBadge o={o} /></td><td>{fecha(o.fecha_ingreso)}</td><td>{fecha(o.fecha_entrega)}</td>
                  <td>{o.satisfaccion ? '★'.repeat(o.satisfaccion) : '—'}</td></tr>))}
              </tbody>
            </table></div>
          )}
          {encuestas.length > 0 && <p className="px-5 py-3 text-sm text-slate-500">Satisfacción promedio: <b>{(encuestas.reduce((s, o) => s + (o.satisfaccion ?? 0), 0) / encuestas.length).toFixed(1)} ★</b> en {encuestas.length} encuesta(s)</p>}
        </Card>
      )}

      {tab === 'vehiculos' && (
        <Card title="Vehículos asociados" action={editar && <button className="btn btn-primary btn-sm" onClick={() => setModal('vehiculo')}><Plus className="h-4 w-4" /> Agregar</button>}>
          {vehiculos.length === 0 ? <Empty icon={Car}>Sin vehículos</Empty> : (
            <ul className="divide-y text-sm">{vehiculos.map(v => {
              const n = ordenes.filter(o => o.vehiculo_id === v.id).length
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span><b>{v.marca} {v.modelo} {v.anio}</b> <span className="font-mono text-slate-500">{v.placas}</span> {v.color && <span className="text-slate-400">· {v.color}</span>} <span className="text-xs text-slate-500">· {n} servicio(s)</span></span>
                  <span className="flex gap-2">
                    {puede('ordenes.gestionar') && <Link className="btn btn-secondary btn-sm" to={`/ordenes/nueva?vehiculo=${v.id}`}>Nueva orden</Link>}
                    {editar && <button className="btn btn-secondary btn-sm" onClick={() => setModal(v)}>Editar</button>}
                  </span>
                </li>)
            })}</ul>
          )}
        </Card>
      )}

      {tab === 'seguimiento' && <Seguimiento clienteId={id} ordenes={ordenes} />}
      {tab === 'cuenta' && <EstadoCuenta clienteId={id} />}

      {modal === 'cliente' && <Modal title="Editar cliente" onClose={() => setModal(null)} wide><ClienteForm c={c} onDone={() => { setModal(null); cargar() }} /></Modal>}
      {modal && modal !== 'cliente' && <Modal title={modal === 'vehiculo' ? 'Agregar vehículo' : 'Editar vehículo'} onClose={() => setModal(null)} wide>
        <VehiculoForm v={modal === 'vehiculo' ? null : modal} clienteId={id} onDone={() => { setModal(null); cargar() }} />
      </Modal>}
    </div>
  )
}
