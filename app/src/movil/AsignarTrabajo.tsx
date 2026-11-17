import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Loader2, Send, Truck, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AREAS, errorTexto, money2 } from '../lib/format'
import { Aviso, Campo, Hoja, botonPrimario, entrada } from './ui'

interface Tarifa { id: number; area: string; actividad: string; importe: number }
interface Tecnico { id: number; nombre: string; area: string; perfil_id: string | null }
interface Proveedor { id: number; nombre: string; telefono: string | null }

/**
 * Asignar un trabajo a un técnico desde la app (mismo registro que "Asignar trabajo" del sistema web).
 * Al guardarlo, el técnico recibe la notificación push y el trabajo aparece en su app.
 */
export default function AsignarTrabajo({ ordenId, folio, onClose, onListo }: { ordenId: number; folio: string; onClose: () => void; onListo: () => void }) {
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [area, setArea] = useState('hojalateria')
  const [tecnicoId, setTecnicoId] = useState('')
  const [tarifaId, setTarifaId] = useState('')
  const [pieza, setPieza] = useState('')
  const [detalle, setDetalle] = useState('')
  const [verTodos, setVerTodos] = useState(false)
  const [externo, setExterno] = useState(false)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedorId, setProveedorId] = useState('')
  const [costo, setCosto] = useState('')
  const [otroImporte, setOtroImporte] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('tarifas_destajo').select('id,area,actividad,importe').eq('activo', true).order('importe').order('actividad').then(({ data }) => setTarifas((data ?? []) as Tarifa[]))
    supabase.from('tecnicos').select('id,nombre,area,perfil_id').eq('activo', true).order('nombre').then(({ data }) => setTecnicos((data ?? []) as Tecnico[]))
    supabase.from('proveedores').select('id,nombre,telefono').eq('activo', true).order('nombre').then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
  }, [])

  // Áreas que tienen técnicos o tarifas
  const areas = useMemo(() => Object.keys(AREAS).filter(a => tecnicos.some(t => t.area === a) || tarifas.some(t => t.area === a)), [tecnicos, tarifas])
  const tecsArea = tecnicos.filter(t => verTodos || t.area === area)
  const tarifasArea = tarifas.filter(t => t.area === area)
  const importesConcepto = [...new Set(tarifas.filter(t => /^concepto/i.test(t.actividad.trim())).map(t => Number(t.importe)))].sort((a, b) => a - b)
  const tarifa = tarifas.find(t => String(t.id) === tarifaId)
  const tecnico = tecnicos.find(t => String(t.id) === tecnicoId)

  function elegirArea(a: string) { setArea(a); setTarifaId(''); if (tecnico && tecnico.area !== a && !verTodos) setTecnicoId('') }

  async function asignar(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (externo ? !proveedorId : !tecnicoId) return setError(externo ? 'Elige al proveedor que hará el trabajo' : 'Elige al técnico que hará el trabajo')
    if (externo && !(Number(costo) > 0)) return setError('Elige el importe por concepto')
    if (!externo && !detalle.trim() && !tarifa) return setError('Elige una tarifa o escribe qué trabajo es')
    setGuardando(true)
    const { error } = await supabase.from('actividades').insert({
      orden_id: ordenId, tarifa_id: tarifa && !externo ? tarifa.id : null, area: (!externo && tarifa?.area) || area,
      actividad: detalle.trim() || (!externo ? tarifa?.actividad : `CONCEPTO ${money2(Number(costo))}`), pieza: pieza.trim() || null,
      tecnico_id: externo ? null : Number(tecnicoId), proveedor_id: externo ? Number(proveedorId) : null,
      costo_proveedor: externo ? Number(costo) : null,
    })
    setGuardando(false)
    if (error) return setError(errorTexto(error))
    onListo()
  }

  const chip = (activo: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[.97] ${activo ? 'bg-brand-600 text-white shadow' : 'bg-slate-100 text-slate-700'}`
  return (
    <Hoja titulo={`Asignar trabajo · ${folio}`} onClose={onClose}>
      <form onSubmit={asignar} className="space-y-4 pb-2">
        {error && <Aviso onClose={() => setError(null)}>{error}</Aviso>}

        <Campo grupo label="1. Área del trabajo">
          <div className="flex flex-wrap gap-2">{areas.map(a => <button key={a} type="button" className={chip(area === a)} onClick={() => elegirArea(a)}>{a === 'detallado' ? 'Detallado / pulido' : AREAS[a]}</button>)}</div>
        </Campo>

        <Campo grupo label="2. ¿Quién lo hará? *">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              {([[false, 'Técnico'], [true, 'Proveedor']] as const).map(([v, l]) => (
                <button key={l} type="button" onClick={() => setExterno(v)} className={`rounded-xl py-2 text-sm font-semibold transition ${externo === v ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>{l}</button>
              ))}
            </div>
            {externo ? <>
              {proveedores.length === 0 && <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No hay proveedores. Agrégalos en el sistema web: Compras → Proveedores.</p>}
              {proveedores.map(p => (
                <button key={p.id} type="button" onClick={() => setProveedorId(String(p.id))}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${proveedorId === String(p.id) ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${proveedorId === String(p.id) ? 'bg-brand-600 text-white' : 'bg-violet-100 text-violet-600'}`}>{proveedorId === String(p.id) ? <Check className="h-5 w-5" /> : <Truck className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.nombre.trim()}</span><span className="text-xs text-slate-500">Proveedor externo{p.telefono ? ` · ${p.telefono}` : ''}</span></span>
                </button>
              ))}
            </> : <>
            {tecsArea.length === 0 && <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No hay técnicos activos de {AREAS[area]}. Toca «Ver todos».</p>}
            {tecsArea.map(t => (
              <button key={t.id} type="button" onClick={() => setTecnicoId(String(t.id))}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${tecnicoId === String(t.id) ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tecnicoId === String(t.id) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{tecnicoId === String(t.id) ? <Check className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.nombre}</span><span className="text-xs text-slate-500">{AREAS[t.area]}{t.perfil_id ? ' · recibe aviso en su app' : ''}</span></span>
              </button>
            ))}
            <button type="button" onClick={() => setVerTodos(!verTodos)} className="text-sm font-semibold text-brand-700">{verTodos ? `Ver solo ${AREAS[area]}` : 'Ver todos los técnicos'}</button>
            </>}
          </div>
        </Campo>

        {externo ? (
          <Campo label="3. Importe por concepto *" ayuda="Pago por servicio: no genera destajo. Al validar el trabajo se registra en los costos de la orden como servicio externo.">
            <select className={entrada} value={otroImporte ? 'otro' : costo} onChange={e => { const v = e.target.value; setOtroImporte(v === 'otro'); setCosto(v === 'otro' ? '' : v) }}>
              <option value="">Selecciona…</option>
              {importesConcepto.map(n => <option key={n} value={n}>CONCEPTO {money2(n)}</option>)}
              <option value="otro">Otro importe…</option>
            </select>
            {otroImporte && <input className={`${entrada} mt-2`} type="number" inputMode="decimal" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} placeholder="Escribe el importe" />}
          </Campo>
        ) : (
        <Campo label="3. Tarifa de destajo" ayuda={tarifa ? `Destajo: ${money2(tarifa.importe)} (se genera al validar el trabajo)` : 'Sin tarifa el trabajo no genera destajo.'}>
          <select className={entrada} value={tarifaId} onChange={e => setTarifaId(e.target.value)}>
            <option value="">Sin tarifa (no genera destajo)</option>
            {tarifasArea.map(t => <option key={t.id} value={t.id}>{t.actividad.trim()} — {money2(t.importe)}</option>)}
          </select>
        </Campo>)}

        <Campo label="4. Pieza o piezas a trabajar"><input className={entrada} value={pieza} onChange={e => setPieza(e.target.value)} placeholder="Ej. Salpicadera izq. y puerta del. izq." /></Campo>
        <Campo label={externo ? 'Descripción del servicio (opcional)' : tarifa ? 'Detalle del trabajo (opcional)' : 'Qué trabajo es *'}><input className={entrada} value={detalle} onChange={e => setDetalle(e.target.value)} placeholder={tarifa?.actividad.trim() ?? 'Ej. Preparar y pintar'} /></Campo>

        <button className={botonPrimario} disabled={guardando}>{guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Asignar trabajo</button>
      </form>
    </Hoja>
  )
}
