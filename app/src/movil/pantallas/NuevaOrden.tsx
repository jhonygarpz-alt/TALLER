import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { subirFoto } from '../../lib/storage'
import { errorTexto, esDomingo, MSG_DOMINGO, sumarDiasLaborables } from '../../lib/format'
import { CHECKLIST_RECEPCION } from '../../pages/vehiculos/Recepcion'
import { Campo, EncabezadoClaro, Vacio, entrada } from '../ui'
import { RejillaEvidencia, fotosVacias, listaFotos, totalFotos, type FotosGuiadas } from '../Evidencia'
import { SelectorAsignacion, asegurarAsignacion, type AsignacionSel } from '../../components/SelectorAsignacion'

interface TipoRep { id: number; nombre: string; dias_objetivo: number; aseguradora_id: number | null }
const COLORES = ['BLANCO', 'NEGRO', 'GRIS', 'PLATA', 'ROJO', 'AZUL', 'VERDE', 'ARENA', 'CAFÉ', 'VINO', 'AMARILLO', 'NARANJA']
const MUESTRA: Record<string, string> = { BLANCO: '#f8fafc', NEGRO: '#111827', GRIS: '#9ca3af', PLATA: '#cbd5e1', ROJO: '#dc2626', AZUL: '#2563eb', VERDE: '#16a34a', ARENA: '#d6c29a', 'CAFÉ': '#7c4a2d', VINO: '#7f1d1d', AMARILLO: '#facc15', NARANJA: '#ea580c' }
const COMBUSTIBLE = ['Reserva', '1/4', '1/2', '3/4', 'Lleno']
const PASOS = ['Origen', 'Propietario y vehículo', 'Condiciones de ingreso', 'Fotografías']

export default function NuevaOrden() {
  const { puede, perfil } = useAuth()
  const nav = useNavigate()
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [aseguradoras, setAseguradoras] = useState<{ id: number; nombre: string }[]>([])
  const [tipos, setTipos] = useState<TipoRep[]>([])
  const [existente, setExistente] = useState<{ vehiculo_id: number; cliente_id: number | null; texto: string } | null>(null)
  const [buscado, setBuscado] = useState(false)
  const [fotos, setFotos] = useState<FotosGuiadas>(fotosVacias('recepcion'))
  const [asig, setAsig] = useState<AsignacionSel | null>(null)
  const [asigNueva, setAsigNueva] = useState(false)
  const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([])
  const [checklist, setChecklist] = useState<Record<string, string>>(Object.fromEntries(CHECKLIST_RECEPCION.map(i => [i, 'bien'])))
  const [f, setF] = useState({
    tipo: 'aseguradora' as 'aseguradora' | 'particular', folio: '', aseguradora_id: '', siniestro: '', tipo_reparacion_id: '', fecha_compromiso: '',
    placas: '', marca: '', modelo: '', anio: '', color: '', cliente_nombre: '', cliente_telefono: '',
    kilometraje: '', combustible: '1/2', danos_reportados: '', objetos: '', asesor_id: perfil?.id ?? '', vin: '',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('aseguradoras').select('id,nombre').eq('activo', true).then(({ data }) => {
      setAseguradoras(data ?? []); if (data?.length) setF(p => ({ ...p, aseguradora_id: p.aseguradora_id || String(data[0].id) }))
    })
    supabase.from('tipos_reparacion').select('*').eq('activo', true).order('dias_objetivo').then(({ data }) => setTipos((data ?? []) as TipoRep[]))
    supabase.from('perfiles').select('id,nombre').eq('activo', true).in('rol', ['asesor', 'administracion', 'direccion', 'supervisor']).order('nombre').then(({ data }) => setAsesores(data ?? []))
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [paso])

  const tiposFiltrados = useMemo(() => tipos.filter(t => f.tipo === 'particular' ? t.aseguradora_id === null : String(t.aseguradora_id) === f.aseguradora_id), [tipos, f.tipo, f.aseguradora_id])
  function elegirTipoRep(t: TipoRep) {
    setF(p => ({ ...p, tipo_reparacion_id: String(t.id), fecha_compromiso: sumarDiasLaborables(new Date(), t.dias_objetivo) }))
  }

  async function buscarPlacas() {
    const pl = f.placas.trim().toUpperCase()
    if (!pl) return
    const { data } = await supabase.from('vehiculos').select('id, cliente_id, marca, modelo, anio, color, clientes(nombre, telefono)').ilike('placas', pl).limit(1)
    setBuscado(true)
    const v = data?.[0] as unknown as { id: number; cliente_id: number | null; marca: string; modelo: string; anio: number | null; color: string | null; clientes: { nombre: string; telefono: string | null } | null } | undefined
    if (!v) { setExistente(null); return }
    setExistente({ vehiculo_id: v.id, cliente_id: v.cliente_id, texto: `${v.marca} ${v.modelo} ${v.anio ?? ''} · ${v.clientes?.nombre ?? 'sin propietario'}` })
    setF(p => ({ ...p, marca: v.marca, modelo: v.modelo, anio: v.anio ? String(v.anio) : '', color: v.color ?? '',
      cliente_nombre: v.clientes?.nombre ?? p.cliente_nombre, cliente_telefono: v.clientes?.telefono ?? p.cliente_telefono }))
  }

  function validar(p: number): string | null {
    if (p === 1) {
      if (f.tipo === 'aseguradora' && !asig && !asigNueva) return 'Elige la asignación de la aseguradora (o registra una nueva)'
      if (f.tipo === 'aseguradora' && asigNueva && !f.siniestro.trim()) return 'Captura el número de siniestro de la asignación nueva'
      if (!f.fecha_compromiso) return 'Elige el tipo de reparación o la fecha compromiso'
      if (esDomingo(f.fecha_compromiso)) return MSG_DOMINGO
    }
    if (p === 2) {
      if (!f.marca.trim() || !f.modelo.trim()) return 'Captura marca y modelo'
      if (!f.cliente_nombre.trim()) return 'Captura el nombre del propietario'
    }
    if (p === 3 && !f.danos_reportados.trim()) return 'Describe los daños reportados'
    return null
  }
  const siguiente = () => {
    const e = validar(paso); setError(e)
    if (e) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setPaso(paso + 1)
    if (paso === 1 && f.placas.trim() && !buscado) buscarPlacas()
  }
  function elegirAsignacion(a: AsignacionSel | null) {
    setAsig(a); setBuscado(false); setExistente(null)
    if (a) setF(p => ({ ...p, siniestro: a.siniestro, cliente_nombre: a.asegurado ?? p.cliente_nombre, cliente_telefono: a.telefono ?? p.cliente_telefono,
      marca: a.marca ?? p.marca, modelo: a.modelo ?? p.modelo, anio: a.anio ? String(a.anio) : p.anio, placas: a.placas ?? p.placas }))
    else setF(p => ({ ...p, siniestro: '' }))
  }

  async function guardar() {
    for (const p of [1, 2, 3]) { const e = validar(p); if (e) { setError(e); setPaso(p); return } }
    if (!totalFotos(fotos) && !confirm('No agregaste fotos de recepción. ¿Crear la orden sin fotos?')) return
    if (f.folio.trim()) {
      const { count } = await supabase.from('ordenes').select('id', { count: 'exact', head: true }).eq('folio', f.folio.trim().toUpperCase())
      if (count) { setError(`El folio ${f.folio.trim().toUpperCase()} ya lo tiene otra orden. Escribe uno distinto o déjalo vacío para usar el consecutivo.`); setPaso(1); return }
    }
    setError(null); setGuardando('Creando orden…')
    try {
      const asignacionFinal = f.tipo !== 'aseguradora' ? null : asig ? asig.id : await asegurarAsignacion({
        aseguradora_id: Number(f.aseguradora_id), siniestro: f.siniestro, asegurado: f.cliente_nombre, telefono: f.cliente_telefono,
        marca: f.marca, modelo: f.modelo, anio: f.anio ? Number(f.anio) : null, placas: f.placas, asesor_id: f.asesor_id || null,
      })
      let clienteId = existente?.cliente_id ?? null
      let vehiculoId = existente?.vehiculo_id ?? null
      if (!clienteId) {
        const { data, error } = await supabase.from('clientes').insert({ nombre: f.cliente_nombre.trim().toUpperCase(), telefono: f.cliente_telefono.replace(/\s/g, '') || null }).select('id').single()
        if (error) throw error
        clienteId = data.id
      }
      if (!vehiculoId) {
        const { data, error } = await supabase.from('vehiculos').insert({ cliente_id: clienteId, marca: f.marca.trim().toUpperCase(), modelo: f.modelo.trim().toUpperCase(), anio: f.anio ? Number(f.anio) : null, placas: f.placas.trim().toUpperCase() || null, color: f.color || null, vin: f.vin.trim().toUpperCase() || null }).select('id').single()
        if (error) throw error
        vehiculoId = data.id
      } else if (!existente?.cliente_id) {
        await supabase.from('vehiculos').update({ cliente_id: clienteId }).eq('id', vehiculoId)
      }
      const { data: orden, error } = await supabase.from('ordenes').insert({
        ...(f.folio.trim() ? { folio: f.folio.trim().toUpperCase() } : {}),
        tipo: f.tipo, aseguradora_id: f.tipo === 'aseguradora' ? Number(f.aseguradora_id) : null,
        siniestro: f.tipo === 'aseguradora' ? f.siniestro.trim() : null, asignacion_id: asignacionFinal,
        cliente_id: clienteId, vehiculo_id: vehiculoId, tipo_reparacion_id: f.tipo_reparacion_id ? Number(f.tipo_reparacion_id) : null,
        fecha_compromiso: f.fecha_compromiso, kilometraje: f.kilometraje ? Number(f.kilometraje) : null,
        danos_reportados: f.danos_reportados.trim(), objetos: f.objetos.trim() || null, asesor_id: f.asesor_id || null,
        checklist_recepcion: { ...checklist, Combustible: f.combustible },
      }).select('id, folio').single()
      if (error) throw error
      let fallidas = 0
      const lista = listaFotos(fotos)
      for (const [i, [file, desc]] of lista.entries()) {
        setGuardando(`Subiendo foto ${i + 1} de ${lista.length}…`)
        try { await subirFoto(file, orden.id, 'recepcion', null, desc) } catch { fallidas++ }
      }
      if (fallidas) alert(`La orden ${orden.folio} se creó, pero ${fallidas} foto(s) no se subieron. Agrégalas desde la orden (pestaña Fotos).`)
      nav(`/orden/${orden.id}`, { replace: true })
    } catch (e) {
      setError(errorTexto(e)); setGuardando(null)
    }
  }

  if (!puede('ordenes.gestionar')) return <Vacio icono={X}>Tu rol no tiene permiso para recibir vehículos.</Vacio>

  return (
    <div className="min-h-screen bg-slate-50">
      <EncabezadoClaro titulo="Recepción de vehículo" sub="Genera una nueva orden de trabajo" atras={() => (confirm('¿Salir sin guardar la orden?') ? nav(-1) : null)}>
        <ol className="mt-5 grid grid-cols-4 gap-1">
          {PASOS.map((nombre, i) => {
            const n = i + 1; const hecho = n < paso; const actual = n === paso
            return (
              <li key={nombre} className="flex flex-col items-center gap-1 text-center">
                <button type="button" disabled={n > paso} onClick={() => setPaso(n)} className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${actual ? 'bg-brand-600 text-white shadow-md shadow-brand-800/30 ring-4 ring-brand-100' : hecho ? 'bg-brand-100 text-brand-700' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{hecho ? <Check className="h-4 w-4" strokeWidth={3} /> : n}</button>
                <span className={`text-[10.5px] leading-tight ${actual ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{nombre}</span>
              </li>
            )
          })}
        </ol>
      </EncabezadoClaro>

      <div className="space-y-5 px-4 pt-2 pb-[calc(110px+env(safe-area-inset-bottom))]">
        <div className="space-y-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">

        {paso === 1 && <>
          <div className="grid grid-cols-2 gap-3">
            {(['aseguradora', 'particular'] as const).map(t => (
              <button key={t} onClick={() => setF(p => ({ ...p, tipo: t, tipo_reparacion_id: '' }))}
                className={`rounded-3xl p-4 text-left ring-2 transition ${f.tipo === t ? 'bg-brand-50 ring-brand-500' : 'bg-white ring-slate-200'}`}>
                <div className="text-lg font-extrabold">{t === 'aseguradora' ? 'Aseguradora' : 'Particular'}</div>
                <div className="text-xs text-slate-500">{t === 'aseguradora' ? `Siniestro asignado${aseguradoras.length === 1 ? ` (${aseguradoras[0].nombre})` : ''}` : 'Cliente directo'}</div>
              </button>
            ))}
          </div>
          {f.tipo === 'aseguradora' && <>
            <Campo label="Aseguradora *"><select className={entrada} value={f.aseguradora_id} onChange={e => { set('aseguradora_id')(e); elegirAsignacion(null); setAsigNueva(false) }}>{aseguradoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>
            <Campo label="Asignación de la aseguradora *" ayuda="Al elegirla se llenan el siniestro, el asegurado y el vehículo.">
              <SelectorAsignacion movil aseguradoraId={f.aseguradora_id} seleccion={asig} nueva={asigNueva} onElegir={elegirAsignacion} onNueva={v => { setAsigNueva(v); elegirAsignacion(null) }} />
            </Campo>
            {asigNueva && <Campo label="Número de siniestro *"><input className={entrada} inputMode="numeric" value={f.siniestro} onChange={set('siniestro')} placeholder="Ej. 4264105478000121" /></Campo>}
          </>}
          <Campo label="Tipo de reparación"><select className={entrada} value={f.tipo_reparacion_id} onChange={e => { const t = tipos.find(x => String(x.id) === e.target.value); if (t) elegirTipoRep(t); else setF(p => ({ ...p, tipo_reparacion_id: '' })) }}>
            <option value="">Selecciona…</option>{tiposFiltrados.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.dias_objetivo} días)</option>)}</select></Campo>
          <Campo label="Folio de la orden" ayuda="Opcional. Déjalo vacío para usar el consecutivo automático (OT-…)."><input className={`${entrada} uppercase`} maxLength={30} value={f.folio} onChange={set('folio')} placeholder="Automático" /></Campo>
          <Campo label="Fecha compromiso de entrega *" ayuda="Se calcula sola con el tipo de reparación (sin contar domingos); puedes cambiarla, pero no a domingo."><input className={entrada} type="date" value={f.fecha_compromiso} onChange={set('fecha_compromiso')} /></Campo>
          <Campo label="Asesor responsable"><select className={entrada} value={f.asesor_id} onChange={set('asesor_id')}><option value="">Sin asignar</option>{asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>
        </>}

        {paso === 2 && <>
          <Campo label="Placas" ayuda={buscado ? (existente ? <span className="font-semibold text-brand-700">✓ Ya registrado: {existente.texto}. Se llenaron sus datos.</span> : 'Placas nuevas: se dará de alta el vehículo.') : 'Busca para recuperar los datos si el auto ya vino antes.'}>
            <div className="flex gap-2">
              <input className={`${entrada} uppercase`} value={f.placas} autoCapitalize="characters" onChange={e => { set('placas')(e); setBuscado(false); setExistente(null) }} onBlur={buscarPlacas} placeholder="ABC123A" />
              <button onClick={buscarPlacas} className="flex w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white" aria-label="Buscar placas"><Search className="h-6 w-6" /></button>
            </div>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Marca"><input className={`${entrada} uppercase`} autoCapitalize="characters" value={f.marca} onChange={set('marca')} placeholder="NISSAN" /></Campo>
            <Campo label="Modelo"><input className={`${entrada} uppercase`} autoCapitalize="characters" value={f.modelo} onChange={set('modelo')} placeholder="VERSA" /></Campo>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Campo label="Año"><input className={entrada} inputMode="numeric" maxLength={4} value={f.anio} onChange={set('anio')} placeholder="2020" /></Campo>
            <Campo label="VIN (opcional)"><input className={`${entrada} uppercase`} autoCapitalize="characters" maxLength={17} value={f.vin} onChange={set('vin')} /></Campo>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Color</span>
            <div className="grid grid-cols-4 gap-2">{COLORES.map(c => (
              <button key={c} onClick={() => setF(p => ({ ...p, color: c }))} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold ring-1 ${f.color === c ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500' : 'bg-white text-slate-600 ring-slate-200'}`}>
                <span className="h-6 w-6 rounded-full ring-1 ring-slate-300" style={{ background: MUESTRA[c] }} />{c}
              </button>
            ))}</div>
          </div>
          <Campo label="Nombre del propietario"><input className={`${entrada} uppercase`} autoCapitalize="characters" value={f.cliente_nombre} onChange={set('cliente_nombre')} /></Campo>
          <Campo label="Teléfono"><input className={entrada} type="tel" inputMode="tel" value={f.cliente_telefono} onChange={set('cliente_telefono')} placeholder="55 1234 5678" /></Campo>
        </>}

        {paso === 3 && <>
          <Campo label="Kilometraje"><input className={entrada} inputMode="numeric" value={f.kilometraje} onChange={set('kilometraje')} placeholder="Ej. 85000" /></Campo>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Combustible</span>
            <div className="grid grid-cols-5 gap-1.5">{COMBUSTIBLE.map(c => <button key={c} onClick={() => setF(p => ({ ...p, combustible: c }))} className={`rounded-xl py-3 text-xs font-bold ring-1 ${f.combustible === c ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200'}`}>{c}</button>)}</div>
          </div>
          <Campo label="Daños reportados"><textarea className={entrada} rows={4} value={f.danos_reportados} onChange={set('danos_reportados')} placeholder="Ej. Golpe en defensa delantera y salpicadera derecha" /></Campo>
          <Campo label="Objetos y accesorios en el auto"><input className={entrada} value={f.objetos} onChange={set('objetos')} placeholder="Ej. Silla de bebé, herramienta" /></Campo>
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Revisión rápida <span className="font-normal text-slate-400">(toca para cambiar)</span></span>
            <div className="grid grid-cols-2 gap-2">{CHECKLIST_RECEPCION.map(item => {
              const v = checklist[item]; const sig = v === 'bien' ? 'danado' : v === 'danado' ? 'no_tiene' : 'bien'
              const est = { bien: ['Bien', 'bg-emerald-50 text-emerald-800 ring-emerald-200'], danado: ['Dañado', 'bg-red-50 text-red-700 ring-red-200'], no_tiene: ['No tiene', 'bg-slate-100 text-slate-500 ring-slate-200'] }[v] ?? ['Bien', '']
              return (
                <button key={item} onClick={() => setChecklist(c => ({ ...c, [item]: sig }))} className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold ring-1 ${est[1]}`}>
                  <span>{item}</span><span className="shrink-0 text-[10px] uppercase">{est[0]}</span>
                </button>
              )
            })}</div>
          </div>
        </>}

        {paso === 4 && <>
          <p className="text-sm text-slate-600">Toca cada casilla para tomar la foto. Son la evidencia de cómo llegó el vehículo.</p>
          <RejillaEvidencia valor={fotos} onChange={setFotos} />
          <div className="rounded-3xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
            <div className="mb-2 font-bold">Resumen</div>
            <div className="space-y-1 text-slate-600">
              <div>{f.tipo === 'aseguradora' ? `${aseguradoras.find(a => String(a.id) === f.aseguradora_id)?.nombre ?? ''} · siniestro ${f.siniestro}` : 'Particular'}</div>
              <div>{f.marca} {f.modelo} {f.anio} · {f.placas || 's/placas'} · {f.color || 'sin color'}</div>
              <div>{f.cliente_nombre} · {f.cliente_telefono || 'sin teléfono'}</div>
              <div>Compromiso: {f.fecha_compromiso} · {totalFotos(fotos)} foto(s)</div>
            </div>
          </div>
        </>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        {error && <div role="alert" className="mx-auto mb-2.5 flex max-w-lg items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <div className="mx-auto flex max-w-lg gap-3">
          {paso > 1 && <button disabled={!!guardando} onClick={() => { setError(null); setPaso(paso - 1) }} className="flex items-center justify-center gap-1 rounded-2xl bg-slate-100 px-5 font-semibold text-slate-700"><ArrowLeft className="h-5 w-5" /> Atrás</button>}
          {paso < 4
            ? <button onClick={siguiente} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-[17px] font-bold text-white shadow-lg">Siguiente <ArrowRight className="h-5 w-5" /></button>
            : <button disabled={!!guardando} onClick={guardar} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-600 py-4 text-[17px] font-bold text-white shadow-lg disabled:opacity-70">
                {guardando ? <><Loader2 className="h-5 w-5 animate-spin" /> {guardando}</> : <><Check className="h-5 w-5" /> Crear orden</>}</button>}
        </div>
      </div>
    </div>
  )
}
