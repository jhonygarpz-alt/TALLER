import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { errorTexto } from '../../lib/format'
import type { VOrden } from '../../lib/tipos'
import { ErrorMsg, Field, Modal } from '../../components/ui'

interface TipoRep { id: number; nombre: string; dias_objetivo: number; aseguradora_id: number | null }

/**
 * Edición de una orden abierta: datos de la orden, del vehículo y del propietario.
 * La etapa, el tipo de servicio y las fechas de cierre no se editan aquí (tienen su propio proceso).
 * Todos los cambios quedan en Auditoría con valores anteriores y nuevos.
 */
export default function EditarOrden({ o, onClose, onGuardado }: { o: VOrden; onClose: () => void; onGuardado: () => void }) {
  const [tipos, setTipos] = useState<TipoRep[]>([])
  const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([])
  const [sucursales, setSucursales] = useState<{ id: number; nombre: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [orden, setOrden] = useState({
    siniestro: o.siniestro ?? '', tipo_reparacion_id: o.tipo_reparacion_id ? String(o.tipo_reparacion_id) : '', fecha_compromiso: o.fecha_compromiso ?? '',
    asesor_id: o.asesor_id ?? '', kilometraje: o.kilometraje != null ? String(o.kilometraje) : '', danos_reportados: o.danos_reportados ?? '',
    objetos: o.objetos ?? '', sucursal_id: '',
  })
  const [veh, setVeh] = useState({ marca: o.marca, modelo: o.modelo, anio: o.anio ? String(o.anio) : '', placas: o.placas ?? '', color: o.color ?? '', vin: '' })
  const [cli, setCli] = useState({ nombre: o.cliente_nombre, telefono: o.cliente_telefono ?? '', email: '' })

  useEffect(() => {
    supabase.from('tipos_reparacion').select('*').eq('activo', true).order('dias_objetivo').then(({ data }) => setTipos((data ?? []) as TipoRep[]))
    supabase.from('perfiles').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => setAsesores(data ?? []))
    supabase.from('sucursales').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => setSucursales(data ?? []))
    supabase.from('ordenes').select('sucursal_id').eq('id', o.id).single().then(({ data }) => data && setOrden(p => ({ ...p, sucursal_id: data.sucursal_id ? String(data.sucursal_id) : '' })))
    supabase.from('vehiculos').select('vin').eq('id', o.vehiculo_id).single().then(({ data }) => data && setVeh(p => ({ ...p, vin: data.vin ?? '' })))
    supabase.from('clientes').select('email').eq('id', o.cliente_id).single().then(({ data }) => data && setCli(p => ({ ...p, email: data.email ?? '' })))
  }, [o.id, o.vehiculo_id, o.cliente_id])

  const tiposOrden = tipos.filter(t => o.tipo === 'particular' ? t.aseguradora_id === null : t.aseguradora_id === o.aseguradora_id)
  const setO = (k: keyof typeof orden) => (e: { target: { value: string } }) => setOrden(p => ({ ...p, [k]: e.target.value }))
  const setV = (k: keyof typeof veh) => (e: { target: { value: string } }) => setVeh(p => ({ ...p, [k]: e.target.value }))
  const setC = (k: keyof typeof cli) => (e: { target: { value: string } }) => setCli(p => ({ ...p, [k]: e.target.value }))

  function cambiarTipo(id: string) {
    const t = tipos.find(x => String(x.id) === id)
    let compromiso = orden.fecha_compromiso
    if (t && confirm(`¿Recalcular la fecha compromiso con el plazo de "${t.nombre}" (${t.dias_objetivo} días desde el ingreso)?`)) {
      const d = new Date(o.fecha_ingreso); d.setDate(d.getDate() + t.dias_objetivo)
      compromiso = d.toLocaleDateString('en-CA')
    }
    setOrden(p => ({ ...p, tipo_reparacion_id: id, fecha_compromiso: compromiso }))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!orden.fecha_compromiso) return setError('La fecha compromiso es obligatoria')
    if (!orden.danos_reportados.trim()) return setError('Describe los daños reportados')
    if (!veh.marca.trim() || !veh.modelo.trim() || !cli.nombre.trim()) return setError('Marca, modelo y nombre del propietario son obligatorios')
    setGuardando(true); setError(null)
    const r1 = await supabase.from('ordenes').update({
      siniestro: o.tipo === 'aseguradora' ? orden.siniestro.trim() || null : null,
      tipo_reparacion_id: orden.tipo_reparacion_id ? Number(orden.tipo_reparacion_id) : null,
      fecha_compromiso: orden.fecha_compromiso, asesor_id: orden.asesor_id || null,
      kilometraje: orden.kilometraje ? Number(orden.kilometraje) : null, danos_reportados: orden.danos_reportados.trim(),
      objetos: orden.objetos.trim() || null, sucursal_id: orden.sucursal_id ? Number(orden.sucursal_id) : null,
    }).eq('id', o.id)
    if (r1.error) { setGuardando(false); return setError(errorTexto(r1.error)) }
    const r2 = await supabase.from('vehiculos').update({
      marca: veh.marca.trim(), modelo: veh.modelo.trim(), anio: veh.anio ? Number(veh.anio) : null,
      placas: veh.placas.trim().toUpperCase() || null, color: veh.color.trim() || null, vin: veh.vin.trim().toUpperCase() || null,
    }).eq('id', o.vehiculo_id)
    if (r2.error) { setGuardando(false); return setError('Orden guardada, pero el vehículo no: ' + errorTexto(r2.error)) }
    const r3 = await supabase.from('clientes').update({ nombre: cli.nombre.trim(), telefono: cli.telefono.trim() || null, email: cli.email.trim() || null }).eq('id', o.cliente_id)
    if (r3.error) { setGuardando(false); return setError('Orden y vehículo guardados, pero el propietario no: ' + errorTexto(r3.error)) }
    onGuardado()
  }

  return (
    <Modal title={`Editar orden ${o.folio}`} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-5">
        <ErrorMsg error={error} />
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="text-sm font-bold sm:col-span-3">Datos de la orden <span className="font-normal text-slate-500">· {o.tipo === 'aseguradora' ? `Aseguradora ${o.aseguradora_nombre}` : 'Particular'}</span></div>
          {o.tipo === 'aseguradora' && <Field label="Número de siniestro"><input className="input" value={orden.siniestro} onChange={setO('siniestro')} /></Field>}
          <Field label="Tipo de reparación">
            <select className="input" value={orden.tipo_reparacion_id} onChange={e => cambiarTipo(e.target.value)}>
              <option value="">—</option>{tiposOrden.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.dias_objetivo} días)</option>)}
            </select>
          </Field>
          <Field label="Fecha compromiso *"><input className="input" type="date" required value={orden.fecha_compromiso} onChange={setO('fecha_compromiso')} /></Field>
          <Field label="Asesor responsable"><select className="input" value={orden.asesor_id} onChange={setO('asesor_id')}><option value="">Sin asignar</option>{asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
          <Field label="Kilometraje"><input className="input" type="number" min={0} value={orden.kilometraje} onChange={setO('kilometraje')} /></Field>
          <Field label="Sucursal"><select className="input" value={orden.sucursal_id} onChange={setO('sucursal_id')}>{sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Field>
          <Field label="Daños reportados *" className="sm:col-span-3"><textarea className="input" rows={2} required value={orden.danos_reportados} onChange={setO('danos_reportados')} /></Field>
          <Field label="Objetos y accesorios" className="sm:col-span-3"><input className="input" value={orden.objetos} onChange={setO('objetos')} /></Field>
        </section>

        <section className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="text-sm font-bold sm:col-span-3">Vehículo <span className="font-normal text-slate-500">· se actualiza en su expediente (aplica a todas sus órdenes)</span></div>
          <Field label="Marca *"><input className="input" required value={veh.marca} onChange={setV('marca')} /></Field>
          <Field label="Modelo *"><input className="input" required value={veh.modelo} onChange={setV('modelo')} /></Field>
          <Field label="Año"><input className="input" type="number" min={1950} max={2100} value={veh.anio} onChange={setV('anio')} /></Field>
          <Field label="Placas"><input className="input uppercase" value={veh.placas} onChange={setV('placas')} /></Field>
          <Field label="Color"><input className="input" value={veh.color} onChange={setV('color')} /></Field>
          <Field label="VIN"><input className="input uppercase" value={veh.vin} onChange={setV('vin')} /></Field>
        </section>

        <section className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="text-sm font-bold sm:col-span-3">Propietario <span className="font-normal text-slate-500">· datos fiscales completos en Clientes y aseguradoras</span></div>
          <Field label="Nombre *"><input className="input" required value={cli.nombre} onChange={setC('nombre')} /></Field>
          <Field label="Teléfono"><input className="input" type="tel" value={cli.telefono} onChange={setC('telefono')} /></Field>
          <Field label="Correo"><input className="input" type="email" value={cli.email} onChange={setC('email')} /></Field>
        </section>

        <p className="text-xs text-slate-500">La etapa se cambia en “Avance de etapa”, y el tipo de servicio (aseguradora o particular) no se puede cambiar porque separa costos y destajos. Cada cambio queda registrado en Auditoría.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Modal>
  )
}
