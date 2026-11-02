import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { subirFoto } from '../../lib/storage'
import { errorTexto, fecha } from '../../lib/format'
import { ErrorMsg, Field, PageHeader, SinPermiso } from '../../components/ui'

export const CHECKLIST_RECEPCION = [
  'Espejos', 'Faros', 'Calaveras', 'Parabrisas', 'Cristales', 'Limpiaparabrisas', 'Antena', 'Tapones de rueda',
  'Llanta de refacción', 'Gato y herramienta', 'Tapetes', 'Estéreo / pantalla', 'Encendedor', 'Molduras', 'Emblemas', 'Tapón de gasolina',
]
const ESTADOS_CHECK: Record<string, string> = { bien: 'Bien', danado: 'Dañado', no_tiene: 'No tiene' }

interface TipoRep { id: number; nombre: string; dias_objetivo: number; aseguradora_id: number | null }

export default function Recepcion() {
  const { puede, perfil } = useAuth()
  const al = useAlertas()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const asignacionId = sp.get('asignacion')
  const vehiculoId = sp.get('vehiculo')
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aseguradoras, setAseguradoras] = useState<{ id: number; nombre: string }[]>([])
  const [tipos, setTipos] = useState<TipoRep[]>([])
  const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([])
  const [existente, setExistente] = useState<{ vehiculo_id: number; cliente_id: number | null; texto: string } | null>(null)
  const [buscado, setBuscado] = useState(false)
  const [fotos, setFotos] = useState<File[]>([])

  const [f, setF] = useState({
    tipo: 'aseguradora' as 'aseguradora' | 'particular', aseguradora_id: '', siniestro: '', tipo_reparacion_id: '', fecha_compromiso: '',
    cliente_nombre: '', cliente_telefono: '', cliente_email: '', cliente_rfc: '',
    marca: '', modelo: '', anio: '', placas: '', color: '', vin: '',
    kilometraje: '', combustible: '1/2', danos_reportados: '', objetos: '', asesor_id: perfil?.id ?? '',
  })
  const [checklist, setChecklist] = useState<Record<string, string>>(Object.fromEntries(CHECKLIST_RECEPCION.map(i => [i, 'bien'])))
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('aseguradoras').select('id,nombre').eq('activo', true).then(({ data }) => {
      setAseguradoras(data ?? [])
      if (data?.length) setF(p => ({ ...p, aseguradora_id: p.aseguradora_id || String(data[0].id) }))
    })
    supabase.from('tipos_reparacion').select('*').eq('activo', true).order('dias_objetivo').then(({ data }) => setTipos((data ?? []) as TipoRep[]))
    supabase.from('perfiles').select('id,nombre').eq('activo', true).in('rol', ['asesor', 'administracion', 'direccion']).order('nombre').then(({ data }) => setAsesores(data ?? []))
    if (asignacionId) {
      supabase.from('asignaciones').select('*').eq('id', asignacionId).single().then(({ data: a }) => {
        if (!a) return
        setF(p => ({
          ...p, tipo: 'aseguradora', aseguradora_id: String(a.aseguradora_id), siniestro: a.siniestro,
          cliente_nombre: a.asegurado, cliente_telefono: a.telefono ?? '', marca: a.marca ?? '', modelo: a.modelo ?? '',
          anio: a.anio ? String(a.anio) : '', placas: a.placas ?? '', asesor_id: a.asesor_id ?? p.asesor_id,
        }))
      })
    }
    if (vehiculoId) buscarPlacas(vehiculoId)
  }, [asignacionId, vehiculoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const tiposFiltrados = useMemo(() => tipos.filter(t => f.tipo === 'particular' ? t.aseguradora_id === null : String(t.aseguradora_id) === f.aseguradora_id), [tipos, f.tipo, f.aseguradora_id])

  function elegirTipoRep(id: string) {
    const t = tipos.find(x => String(x.id) === id)
    const d = new Date(); if (t) d.setDate(d.getDate() + t.dias_objetivo)
    setF(p => ({ ...p, tipo_reparacion_id: id, fecha_compromiso: t ? d.toLocaleDateString('en-CA') : p.fecha_compromiso }))
  }

  async function buscarPlacas(porId?: string) {
    const pl = f.placas.trim().toUpperCase()
    if (!pl && !porId) return
    const base = supabase.from('vehiculos').select('id, cliente_id, marca, modelo, anio, color, vin, placas, clientes(nombre, telefono, email, rfc)')
    const { data } = await (porId ? base.eq('id', porId) : base.ilike('placas', pl)).limit(1)
    setBuscado(true)
    const v = data?.[0] as unknown as { id: number; cliente_id: number | null; marca: string; modelo: string; anio: number | null; color: string | null; vin: string | null; placas: string | null; clientes: { nombre: string; telefono: string | null; email: string | null; rfc: string | null } | null } | undefined
    if (!v) { setExistente(null); return }
    if (porId) setF(p => ({ ...p, placas: v.placas ?? '' }))
    setExistente({ vehiculo_id: v.id, cliente_id: v.cliente_id, texto: `${v.marca} ${v.modelo} ${v.anio ?? ''} de ${v.clientes?.nombre ?? 'sin propietario'}` })
    setF(p => ({ ...p, marca: v.marca, modelo: v.modelo, anio: v.anio ? String(v.anio) : '', color: v.color ?? '', vin: v.vin ?? '',
      cliente_nombre: v.clientes?.nombre ?? p.cliente_nombre, cliente_telefono: v.clientes?.telefono ?? p.cliente_telefono,
      cliente_email: v.clientes?.email ?? '', cliente_rfc: v.clientes?.rfc ?? '' }))
  }

  function validar(p: number): string | null {
    if (p === 1) {
      if (f.tipo === 'aseguradora' && (!f.aseguradora_id || !f.siniestro.trim())) return 'Indica la aseguradora y el número de siniestro'
      if (!f.fecha_compromiso) return 'Indica la fecha compromiso de entrega (o elige el tipo de reparación)'
    }
    if (p === 2) {
      if (!f.cliente_nombre.trim()) return 'Indica el nombre del propietario'
      if (!f.marca.trim() || !f.modelo.trim()) return 'Indica marca y modelo'
    }
    if (p === 3 && !f.danos_reportados.trim()) return 'Describe los daños reportados'
    return null
  }
  const siguiente = () => { const e = validar(paso); setError(e); if (!e) setPaso(paso + 1) }

  async function guardar() {
    for (const p of [1, 2, 3]) { const e = validar(p); if (e) { setError(e); setPaso(p); return } }
    setGuardando(true); setError(null)
    try {
      let clienteId = existente?.cliente_id ?? null
      let vehiculoId = existente?.vehiculo_id ?? null
      if (!clienteId) {
        const { data, error } = await supabase.from('clientes').insert({ nombre: f.cliente_nombre.trim(), telefono: f.cliente_telefono || null, email: f.cliente_email || null, rfc: f.cliente_rfc || null }).select('id').single()
        if (error) throw error
        clienteId = data.id
      }
      if (!vehiculoId) {
        const { data, error } = await supabase.from('vehiculos').insert({ cliente_id: clienteId, marca: f.marca.trim(), modelo: f.modelo.trim(), anio: f.anio ? Number(f.anio) : null, placas: f.placas.trim().toUpperCase() || null, color: f.color || null, vin: f.vin.trim().toUpperCase() || null }).select('id').single()
        if (error) throw error
        vehiculoId = data.id
      } else if (!existente?.cliente_id) {
        await supabase.from('vehiculos').update({ cliente_id: clienteId }).eq('id', vehiculoId)
      }
      const { data: orden, error } = await supabase.from('ordenes').insert({
        tipo: f.tipo, aseguradora_id: f.tipo === 'aseguradora' ? Number(f.aseguradora_id) : null,
        siniestro: f.tipo === 'aseguradora' ? f.siniestro.trim() : null, asignacion_id: asignacionId ? Number(asignacionId) : null,
        cliente_id: clienteId, vehiculo_id: vehiculoId, tipo_reparacion_id: f.tipo_reparacion_id ? Number(f.tipo_reparacion_id) : null,
        fecha_compromiso: f.fecha_compromiso, kilometraje: f.kilometraje ? Number(f.kilometraje) : null,
        danos_reportados: f.danos_reportados.trim(), objetos: f.objetos.trim() || null, asesor_id: f.asesor_id || null,
        checklist_recepcion: { ...checklist, Combustible: f.combustible },
      }).select('id').single()
      if (error) throw error
      const fallidas: string[] = []
      for (const file of fotos) {
        try { await subirFoto(file, orden.id, 'recepcion') } catch { fallidas.push(file.name) }
      }
      al.recargar()
      if (fallidas.length) alert(`La orden se creó, pero ${fallidas.length} foto(s) no se pudieron subir. Agrégalas desde el expediente.`)
      nav(`/ordenes/${orden.id}`)
    } catch (e) {
      setError(errorTexto(e))
      setGuardando(false)
    }
  }

  if (!puede('ordenes.gestionar')) return <SinPermiso que="la recepción de vehículos" />

  const pasos = ['Origen', 'Propietario y vehículo', 'Condiciones de ingreso', 'Fotografías']
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/ordenes" className="text-sm font-medium text-brand-700 hover:underline">← Órdenes de trabajo</Link>
      <PageHeader title="Recepción de vehículo" subtitle={asignacionId ? `Desde asignación · siniestro ${f.siniestro}` : 'Genera una nueva orden de trabajo'} />

      <ol className="mb-6 grid grid-cols-4 gap-2">
        {pasos.map((p, i) => (
          <li key={p} className="flex flex-col items-center gap-1 text-center">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${paso > i + 1 ? 'bg-green-600 text-white' : paso === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {paso > i + 1 ? <Check className="h-5 w-5" /> : i + 1}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${paso === i + 1 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{p}</span>
          </li>
        ))}
      </ol>

      <div className="card space-y-4">
        <ErrorMsg error={error} />

        {paso === 1 && (<>
          <div className="grid grid-cols-2 gap-3">
            {(['aseguradora', 'particular'] as const).map(t => (
              <button key={t} type="button" disabled={!!asignacionId && t === 'particular'} onClick={() => setF(p => ({ ...p, tipo: t, tipo_reparacion_id: '' }))}
                className={`rounded-xl border-2 p-4 text-left transition disabled:opacity-40 ${f.tipo === t ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <div className="text-lg font-bold">{t === 'aseguradora' ? 'Aseguradora' : 'Particular'}</div>
                <div className="text-xs text-slate-500">{t === 'aseguradora' ? 'Siniestro asignado (MAPFRE)' : 'Cliente directo'}</div>
              </button>
            ))}
          </div>
          {f.tipo === 'aseguradora' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Aseguradora *"><select className="input" value={f.aseguradora_id} disabled={!!asignacionId} onChange={e => setF(p => ({ ...p, aseguradora_id: e.target.value, tipo_reparacion_id: '' }))}>{aseguradoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Field>
              <Field label="Número de siniestro *"><input className="input" value={f.siniestro} disabled={!!asignacionId} onChange={set('siniestro')} /></Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de reparación" hint="Define los días objetivo según el convenio">
              <select className="input" value={f.tipo_reparacion_id} onChange={e => elegirTipoRep(e.target.value)}>
                <option value="">Selecciona…</option>{tiposFiltrados.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.dias_objetivo} días)</option>)}
              </select>
            </Field>
            <Field label="Fecha compromiso de entrega *"><input className="input" type="date" value={f.fecha_compromiso} onChange={set('fecha_compromiso')} /></Field>
          </div>
          <Field label="Asesor responsable">
            <select className="input" value={f.asesor_id} onChange={set('asesor_id')}><option value="">Sin asignar</option>{asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
          </Field>
        </>)}

        {paso === 2 && (<>
          <div className="flex gap-2">
            <Field label="Placas" className="flex-1"><input className="input uppercase" value={f.placas} onChange={e => { set('placas')(e); setBuscado(false); setExistente(null) }} onBlur={() => buscarPlacas()} /></Field>
            <button type="button" className="btn btn-secondary mt-5" onClick={() => buscarPlacas()}><Search className="h-4 w-4" /> Buscar</button>
          </div>
          {existente && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">✓ Vehículo ya registrado: <b>{existente.texto}</b>. Se reutilizarán sus datos (sin capturar dos veces).</div>}
          {buscado && !existente && f.placas && <div className="text-xs text-slate-500">Placas no registradas: se dará de alta un vehículo nuevo.</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Marca *"><input className="input" value={f.marca} disabled={!!existente} onChange={set('marca')} /></Field>
            <Field label="Modelo *"><input className="input" value={f.modelo} disabled={!!existente} onChange={set('modelo')} /></Field>
            <Field label="Año"><input className="input" type="number" value={f.anio} disabled={!!existente} onChange={set('anio')} /></Field>
            <Field label="Color"><input className="input" value={f.color} disabled={!!existente} onChange={set('color')} /></Field>
            <Field label="No. de serie (VIN)" className="sm:col-span-2"><input className="input uppercase" value={f.vin} disabled={!!existente} onChange={set('vin')} /></Field>
          </div>
          <div className="border-t pt-4 text-sm font-semibold">Propietario</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre *"><input className="input" value={f.cliente_nombre} disabled={!!existente?.cliente_id} onChange={set('cliente_nombre')} /></Field>
            <Field label="Teléfono"><input className="input" type="tel" value={f.cliente_telefono} disabled={!!existente?.cliente_id} onChange={set('cliente_telefono')} /></Field>
            <Field label="Correo"><input className="input" type="email" value={f.cliente_email} disabled={!!existente?.cliente_id} onChange={set('cliente_email')} /></Field>
            <Field label="RFC"><input className="input uppercase" value={f.cliente_rfc} disabled={!!existente?.cliente_id} onChange={set('cliente_rfc')} /></Field>
          </div>
        </>)}

        {paso === 3 && (<>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Kilometraje"><input className="input" type="number" min={0} value={f.kilometraje} onChange={set('kilometraje')} /></Field>
            <Field label="Combustible"><select className="input" value={f.combustible} onChange={set('combustible')}>{['Reserva', '1/4', '1/2', '3/4', 'Lleno'].map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Fecha y hora de ingreso"><input className="input" disabled value={new Date().toLocaleString('es-MX')} /></Field>
          </div>
          <Field label="Daños reportados *"><textarea className="input" rows={3} value={f.danos_reportados} onChange={set('danos_reportados')} placeholder="Ej. Golpe en puerta delantera izquierda y defensa" /></Field>
          <div>
            <div className="label">Checklist de condiciones físicas</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CHECKLIST_RECEPCION.map(item => (
                <div key={item} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span>{item}</span>
                  <div className="flex overflow-hidden rounded-md ring-1 ring-slate-200">
                    {Object.entries(ESTADOS_CHECK).map(([k, v]) => (
                      <button key={k} type="button" onClick={() => setChecklist(c => ({ ...c, [item]: k }))}
                        className={`px-2 py-1 text-[11px] font-semibold ${checklist[item] === k ? (k === 'bien' ? 'bg-green-600 text-white' : k === 'danado' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white') : 'bg-white text-slate-500'}`}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Field label="Objetos y accesorios registrados"><textarea className="input" rows={2} value={f.objetos} onChange={set('objetos')} placeholder="Ej. Silla para bebé, paraguas, documentos en guantera" /></Field>
        </>)}

        {paso === 4 && (<>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-400">
            <Camera className="h-10 w-10 text-slate-400" />
            <span className="font-semibold">Tomar o seleccionar fotografías de recepción</span>
            <span className="text-xs text-slate-500">Frente, costados, posterior, daños, tablero (kilometraje)</span>
            <input type="file" accept="image/*" multiple capture="environment" hidden onChange={e => setFotos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
          </label>
          {fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fotos.map((file, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(file)} alt="" className="h-20 w-28 rounded-lg object-cover" />
                  <button type="button" className="absolute -top-2 -right-2 rounded-full bg-red-600 px-1.5 text-xs text-white" onClick={() => setFotos(fotos.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <b>Resumen:</b> {f.tipo === 'aseguradora' ? `${aseguradoras.find(a => String(a.id) === f.aseguradora_id)?.nombre} · siniestro ${f.siniestro}` : 'Particular'} ·
            {' '}{f.marca} {f.modelo} {f.placas} · {f.cliente_nombre} · Entrega comprometida: <b>{fecha(f.fecha_compromiso)}</b>
          </div>
        </>)}

        <div className="flex justify-between border-t pt-4">
          {paso > 1 ? <button className="btn btn-secondary" onClick={() => setPaso(paso - 1)}><ArrowLeft className="h-4 w-4" /> Atrás</button> : <span />}
          {paso < 4
            ? <button className="btn btn-primary" onClick={siguiente}>Siguiente <ArrowRight className="h-4 w-4" /></button>
            : <button className="btn btn-success" onClick={guardar} disabled={guardando}>{guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : <><Check className="h-4 w-4" /> Crear orden de trabajo</>}</button>}
        </div>
      </div>
    </div>
  )
}
