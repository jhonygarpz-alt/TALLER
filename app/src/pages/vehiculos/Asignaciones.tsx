import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Car, Download, Inbox, Pencil, Phone, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { ESTATUS_CONTACTO, clean, errorTexto, fecha, fechaHora, hoyISO, limpiaBusqueda } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import { Badge, Card, Empty, ErrorMsg, Field, Modal } from '../../components/ui'

interface Asignacion {
  id: number; aseguradora_id: number; siniestro: string; asegurado: string; telefono: string | null
  marca: string | null; modelo: string | null; anio: number | null; placas: string | null; fecha_asignacion: string
  asesor_id: string | null; estatus: string; primer_contacto: string | null; ultimo_intento: string | null; intentos: number
  fecha_cita: string | null; motivo_no_cita: string | null; notas: string | null
  aseguradoras?: { nombre: string }; perfiles?: { nombre: string } | null; ordenes?: { id: number; folio: string } | { id: number; folio: string }[] | null
}
interface Contacto { id: number; fecha: string; medio: string; resultado: string; fecha_cita: string | null; notas: string | null; perfiles?: { nombre: string } | null }

const RESULTADOS: Record<string, string> = {
  contactado: 'Contactado', no_contesta: 'No contesta', numero_erroneo: 'Número erróneo', cita_programada: 'Cita programada',
  reprogramada: 'Cita reprogramada', no_acepta: 'No acepta / no concreta cita', otro: 'Otro',
}
const MEDIOS: Record<string, string> = { llamada: 'Llamada', whatsapp: 'WhatsApp', sms: 'SMS', correo: 'Correo', presencial: 'Presencial' }

/** Alta y edición de una asignación. En edición, si ya está ligada a una orden, el siniestro y la aseguradora quedan fijos. */
function FormAsignacion({ onDone, actual }: { onDone: () => void; actual?: Asignacion }) {
  const [aseg, setAseg] = useState<{ id: number; nombre: string }[]>([])
  const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([])
  const v = (x: unknown) => x == null ? '' : String(x)
  const [f, setF] = useState(actual
    ? { aseguradora_id: v(actual.aseguradora_id), siniestro: actual.siniestro, asegurado: actual.asegurado, telefono: v(actual.telefono), marca: v(actual.marca), modelo: v(actual.modelo), anio: v(actual.anio), placas: v(actual.placas), fecha_asignacion: actual.fecha_asignacion, asesor_id: v(actual.asesor_id), notas: v(actual.notas) }
    : { aseguradora_id: '', siniestro: '', asegurado: '', telefono: '', marca: '', modelo: '', anio: '', placas: '', fecha_asignacion: hoyISO(), asesor_id: '', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const ligada = !!actual && actual.estatus === 'ingresado'
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('aseguradoras').select('id,nombre').eq('activo', true).order('nombre').then(({ data }) => {
      setAseg(data ?? []); if (data?.length === 1) setF(p => ({ ...p, aseguradora_id: String(data[0].id) }))
    })
    supabase.from('perfiles').select('id,nombre,rol').eq('activo', true).in('rol', ['asesor', 'administracion', 'direccion']).order('nombre')
      .then(({ data }) => setAsesores(data ?? []))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null)
    const datos = { ...f, placas: f.placas.toUpperCase().trim(), siniestro: f.siniestro.trim(), asegurado: f.asegurado.trim() }
    setGuardando(true)
    const { error } = actual
      ? await supabase.from('asignaciones').update({
          ...(ligada ? {} : { aseguradora_id: Number(datos.aseguradora_id), siniestro: datos.siniestro }),
          asegurado: datos.asegurado, telefono: datos.telefono.trim() || null, marca: datos.marca.trim() || null, modelo: datos.modelo.trim() || null,
          anio: datos.anio ? Number(datos.anio) : null, placas: datos.placas || null, fecha_asignacion: datos.fecha_asignacion,
          asesor_id: datos.asesor_id || null, notas: datos.notas.trim() || null,
        }).eq('id', actual.id)
      : await supabase.from('asignaciones').insert(clean(datos))
    setGuardando(false)
    if (error) return setError(error.message.includes('duplicate') ? 'Ese número de siniestro ya está registrado' : errorTexto(error))
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
      <Field label="Aseguradora *">
        <select className="input" required disabled={ligada} value={f.aseguradora_id} onChange={set('aseguradora_id')}>
          <option value="">Selecciona…</option>{aseg.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </Field>
      <Field label="Número de siniestro *" hint={ligada ? 'Ya está ligada a una orden: el siniestro y la aseguradora no se cambian aquí.' : undefined}><input className="input" required disabled={ligada} value={f.siniestro} onChange={set('siniestro')} /></Field>
      <Field label="Nombre del asegurado *"><input className="input" required value={f.asegurado} onChange={set('asegurado')} /></Field>
      <Field label="Teléfono"><input className="input" type="tel" value={f.telefono} onChange={set('telefono')} /></Field>
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        <Field label="Marca"><input className="input" value={f.marca} onChange={set('marca')} /></Field>
        <Field label="Modelo"><input className="input" value={f.modelo} onChange={set('modelo')} /></Field>
        <Field label="Año"><input className="input" type="number" min={1950} max={2100} value={f.anio} onChange={set('anio')} /></Field>
      </div>
      <Field label="Placas"><input className="input uppercase" value={f.placas} onChange={set('placas')} /></Field>
      <Field label="Fecha de asignación"><input className="input" type="date" required value={f.fecha_asignacion} onChange={set('fecha_asignacion')} /></Field>
      <Field label="Asesor responsable" className="sm:col-span-2">
        <select className="input" value={f.asesor_id} onChange={set('asesor_id')}>
          <option value="">Sin asignar</option>{asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </Field>
      <Field label="Notas" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notas} onChange={set('notas')} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button>
        <button className="btn btn-primary" disabled={guardando}>{actual ? 'Guardar cambios' : 'Registrar asignación'}</button>
      </div>
    </form>
  )
}

function DetalleAsignacion({ id, onClose, onCambio }: { id: number; onClose: () => void; onCambio: () => void }) {
  const { puede } = useAuth()
  const [a, setA] = useState<Asignacion | null>(null)
  const [hist, setHist] = useState<Contacto[]>([])
  const [f, setF] = useState({ medio: 'llamada', resultado: 'contactado', fecha_cita: '', notas: '' })
  const [error, setError] = useState<string | null>(null)
  const [cancelar, setCancelar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [editar, setEditar] = useState(false)

  const cargar = useCallback(async () => {
    const [x, h] = await Promise.all([
      supabase.from('asignaciones').select('*, aseguradoras(nombre), perfiles(nombre), ordenes(id,folio)').eq('id', id).single(),
      supabase.from('contactos').select('*, perfiles(nombre)').eq('asignacion_id', id).order('fecha', { ascending: false }),
    ])
    setA(x.data as Asignacion); setHist((h.data ?? []) as Contacto[])
  }, [id])
  useEffect(() => { cargar() }, [cargar])

  async function registrar(e: FormEvent) {
    e.preventDefault(); setError(null)
    const conCita = ['cita_programada', 'reprogramada'].includes(f.resultado)
    const { error } = await supabase.from('contactos').insert({
      asignacion_id: id, medio: f.medio, resultado: f.resultado, notas: f.notas || null,
      fecha_cita: conCita && f.fecha_cita ? new Date(f.fecha_cita).toISOString() : null,
    })
    if (error) return setError(errorTexto(error))
    setF({ medio: 'llamada', resultado: 'contactado', fecha_cita: '', notas: '' })
    cargar(); onCambio()
  }

  async function cancelarAsig() {
    if (!motivo.trim()) return setError('Indica el motivo de la cancelación')
    const { error } = await supabase.from('asignaciones').update({ estatus: 'cancelada', motivo_no_cita: motivo.trim() }).eq('id', id)
    if (error) return setError(errorTexto(error))
    setCancelar(false); cargar(); onCambio()
  }

  if (!a) return <Modal title="Asignación" onClose={onClose}><div className="text-slate-400">Cargando…</div></Modal>
  if (editar) return <Modal title={`Editar asignación · ${a.siniestro}`} onClose={() => setEditar(false)} wide><FormAsignacion actual={a} onDone={() => { setEditar(false); cargar(); onCambio() }} /></Modal>
  const cerrada = ['ingresado', 'cancelada'].includes(a.estatus)
  const orden = Array.isArray(a.ordenes) ? a.ordenes[0] : a.ordenes
  return (
    <Modal title={`Siniestro ${a.siniestro}`} onClose={onClose} wide>
      <ErrorMsg error={error} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2"><Badge cls={ESTATUS_CONTACTO[a.estatus].badge}>{ESTATUS_CONTACTO[a.estatus].label}</Badge><span className="text-slate-500">{a.aseguradoras?.nombre}</span></div>
          <div className="text-lg font-bold">{a.asegurado}</div>
          {a.telefono && <a href={`tel:${a.telefono}`} className="inline-flex items-center gap-1 text-brand-700"><Phone className="h-4 w-4" /> {a.telefono}</a>}
          <div className="text-slate-600"><Car className="mr-1 inline h-4 w-4" />{[a.marca, a.modelo, a.anio].filter(Boolean).join(' ') || 'Sin datos del vehículo'} {a.placas && `· ${a.placas}`}</div>
          <div className="text-slate-500">Asignada {fecha(a.fecha_asignacion)} · Asesor: {a.perfiles?.nombre ?? 'sin asignar'}</div>
          <div className="text-slate-500">Intentos: {a.intentos} · Primer contacto: {fechaHora(a.primer_contacto)}</div>
          {a.fecha_cita && <div className="font-semibold text-purple-700">Cita: {fechaHora(a.fecha_cita)}</div>}
          {a.motivo_no_cita && <div className="text-slate-600">Motivo sin cita: {a.motivo_no_cita}</div>}
          {a.notas && <div className="text-slate-600">{a.notas}</div>}
          <div className="flex flex-wrap gap-2 pt-2">
            {puede('asignaciones.gestionar') && <button className="btn btn-secondary btn-sm" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" /> Editar datos</button>}
            {orden && <Link to={`/ordenes/${orden.id}`} className="btn btn-secondary btn-sm">Ver orden {orden.folio}</Link>}
            {!cerrada && puede('ordenes.gestionar') && <Link to={`/ordenes/nueva?asignacion=${a.id}`} className="btn btn-success btn-sm"><Car className="h-4 w-4" /> Recibir vehículo</Link>}
            {!cerrada && puede('asignaciones.gestionar') && <button className="btn btn-ghost btn-sm text-red-600" onClick={() => setCancelar(!cancelar)}>Cancelar asignación</button>}
          </div>
          {cancelar && (
            <div className="flex gap-2 pt-2"><input className="input" placeholder="Motivo de cancelación" value={motivo} onChange={e => setMotivo(e.target.value)} /><button className="btn btn-danger btn-sm" onClick={cancelarAsig}>Confirmar</button></div>
          )}
        </div>

        {!cerrada && puede('asignaciones.gestionar') && (
          <form onSubmit={registrar} className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div className="font-semibold">Registrar intento de contacto</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Medio"><select className="input" value={f.medio} onChange={e => setF({ ...f, medio: e.target.value })}>{Object.entries(MEDIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Resultado"><select className="input" value={f.resultado} onChange={e => setF({ ...f, resultado: e.target.value })}>{Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            {['cita_programada', 'reprogramada'].includes(f.resultado) && (
              <Field label="Fecha y hora de la cita *"><input className="input" type="datetime-local" required value={f.fecha_cita} onChange={e => setF({ ...f, fecha_cita: e.target.value })} /></Field>
            )}
            <Field label={f.resultado === 'no_acepta' ? 'Motivo por el que no se concretó *' : 'Notas'}>
              <textarea className="input" rows={2} required={f.resultado === 'no_acepta'} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} />
            </Field>
            <button className="btn btn-primary w-full"><CalendarPlus className="h-4 w-4" /> Guardar contacto</button>
          </form>
        )}
      </div>

      <h3 className="mt-6 mb-2 font-semibold">Historial de contacto</h3>
      {hist.length === 0 ? <p className="text-sm text-slate-400">Sin intentos registrados</p> : (
        <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm">
          {hist.map(h => (
            <li key={h.id}>
              <div className="font-medium">{RESULTADOS[h.resultado]} <span className="font-normal text-slate-500">· {MEDIOS[h.medio]} · {fechaHora(h.fecha)} · {h.perfiles?.nombre ?? ''}</span></div>
              {h.fecha_cita && <div className="text-purple-700">Cita: {fechaHora(h.fecha_cita)}</div>}
              {h.notas && <div className="text-slate-600">{h.notas}</div>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}

export default function Asignaciones() {
  const { puede } = useAuth()
  const al = useAlertas()
  const [sp, setSp] = useSearchParams()
  const estatus = sp.get('estatus') ?? 'abiertas'
  const ver = sp.get('ver')
  const [rows, setRows] = useState<Asignacion[]>([])
  const [q, setQ] = useState('')
  const [nueva, setNueva] = useState(false)
  const [editando, setEditando] = useState<Asignacion | null>(null)
  const editar = puede('asignaciones.gestionar')

  const cargar = useCallback(async () => {
    let query = supabase.from('asignaciones').select('*, aseguradoras(nombre), perfiles(nombre)').order('fecha_asignacion', { ascending: false }).limit(500)
    if (estatus === 'abiertas') query = query.not('estatus', 'in', '(ingresado,cancelada)')
    else if (estatus !== 'todas') query = query.eq('estatus', estatus)
    const s = limpiaBusqueda(q)
    if (s) query = query.or(['siniestro', 'asegurado', 'placas', 'telefono'].map(c => `${c}.ilike.%${s}%`).join(','))
    const { data } = await query
    setRows((data ?? []) as Asignacion[])
  }, [estatus, q])
  useEffect(() => { const t = setTimeout(cargar, 200); return () => clearTimeout(t) }, [cargar])

  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-64" placeholder="Siniestro, asegurado, placas…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {[['abiertas', 'Abiertas'], ...Object.entries(ESTATUS_CONTACTO).map(([k, v]) => [k, v.label]), ['todas', 'Todas']].map(([k, l]) => (
            <button key={k} onClick={() => setParam('estatus', k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${estatus === k ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>{l}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => descargarCSV('asignaciones', rows.map(r => ({ ...r, aseguradora: r.aseguradoras?.nombre, asesor: r.perfiles?.nombre, estatus: ESTATUS_CONTACTO[r.estatus].label })), [
            { key: 'aseguradora', label: 'Aseguradora' }, { key: 'siniestro', label: 'Siniestro' }, { key: 'asegurado', label: 'Asegurado' }, { key: 'telefono', label: 'Teléfono' },
            { key: 'marca', label: 'Marca' }, { key: 'modelo', label: 'Modelo' }, { key: 'placas', label: 'Placas' }, { key: 'fecha_asignacion', label: 'Fecha asignación' },
            { key: 'asesor', label: 'Asesor' }, { key: 'estatus', label: 'Estatus' }, { key: 'intentos', label: 'Intentos' }, { key: 'fecha_cita', label: 'Cita' }, { key: 'motivo_no_cita', label: 'Motivo sin cita' },
          ])}><Download className="h-4 w-4" /> Excel</button>
          {puede('asignaciones.gestionar') && <button className="btn btn-primary btn-sm" onClick={() => setNueva(true)}><Plus className="h-4 w-4" /> Nueva asignación</button>}
        </div>
      </div>

      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Inbox}>Sin asignaciones con este filtro</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Siniestro</th><th>Asegurado</th><th>Vehículo</th><th>Asignación</th><th>Asesor</th><th>Estatus</th><th>Cita</th><th className="text-right">Intentos</th>{editar && <th className="w-10"></th>}</tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setParam('ver', String(r.id))}>
                  <td className="font-bold">{r.siniestro}<div className="text-xs font-normal text-slate-500">{r.aseguradoras?.nombre}</div></td>
                  <td>{r.asegurado}<div className="text-xs text-slate-500">{r.telefono}</div></td>
                  <td>{[r.marca, r.modelo, r.anio].filter(Boolean).join(' ') || '—'}<div className="text-xs text-slate-500">{r.placas}</div></td>
                  <td className="whitespace-nowrap">{fecha(r.fecha_asignacion)}</td>
                  <td className="text-xs">{r.perfiles?.nombre ?? '—'}</td>
                  <td><Badge cls={ESTATUS_CONTACTO[r.estatus].badge}>{ESTATUS_CONTACTO[r.estatus].label}</Badge></td>
                  <td className="whitespace-nowrap">{r.fecha_cita ? fechaHora(r.fecha_cita) : '—'}</td>
                  <td className="text-right">{r.intentos}</td>
                  {editar && <td className="text-right"><button className="rounded-full p-2 text-[#17657c] transition hover:bg-[#e3f3f7]" title="Editar asignación" aria-label={`Editar asignación ${r.siniestro}`}
                    onClick={e => { e.stopPropagation(); setEditando(r) }}><Pencil className="h-4 w-4" /></button></td>}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {nueva && <Modal title="Nueva asignación" onClose={() => setNueva(false)} wide><FormAsignacion onDone={() => { setNueva(false); cargar(); al.recargar() }} /></Modal>}
      {editando && <Modal title={`Editar asignación · ${editando.siniestro}`} onClose={() => setEditando(null)} wide><FormAsignacion actual={editando} onDone={() => { setEditando(null); cargar(); al.recargar() }} /></Modal>}
      {ver && <DetalleAsignacion id={Number(ver)} onClose={() => setParam('ver', null)} onCambio={() => { cargar(); al.recargar() }} />}
    </div>
  )
}
