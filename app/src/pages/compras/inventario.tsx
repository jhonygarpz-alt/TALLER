import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeftRight, Download, Package, Paintbrush, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

import { ESTADO_COMPRA, ESTADO_SOLICITUD, TIPOS_MATERIAL, clean, errorTexto, fecha, fechaHora, hoyISO, money2, num } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Material, Proveedor } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, Modal } from '../../components/ui'
import Solicitudes from '../../components/Solicitudes'
import UnidadSelect from '../../components/UnidadSelect'

/* ----------------------------- SOLICITUDES ----------------------------- */
export function TabSolicitudes() {
  const [sp] = useSearchParams()
  const [estado, setEstado] = useState('solicitada')
  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-1">
        {[...Object.entries(ESTADO_SOLICITUD).map(([k, v]) => [k, v.label]), ['todas', 'Todas']].map(([k, l]) => (
          <button key={k} onClick={() => setEstado(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${estado === k ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
      </div>
      <Solicitudes filtroEstado={estado} abrirNueva={sp.get('nueva') === '1'} />
    </Card>
  )
}

/* ----------------------------- MATERIALES ----------------------------- */
function MaterialForm({ m, proveedores, onDone }: { m: Material | null; proveedores: Proveedor[]; onDone: () => void }) {
  const [f, setF] = useState({
    codigo: m?.codigo ?? '', descripcion: m?.descripcion ?? '', tipo: m?.tipo ?? 'material', categoria: m?.categoria ?? '',
    unidad: m?.unidad ?? 'pza', minimo: String(m?.minimo ?? 0), proveedor_id: String(m?.proveedor_id ?? ''), activo: m?.activo ?? true,
  })
  const [secciones, setSecciones] = useState<string[]>((m as { secciones?: string[] } | null)?.secciones ?? [])
  const [sobrePedido, setSobrePedido] = useState(!!m?.sobre_pedido)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function submit(e: FormEvent) {
    e.preventDefault()
    const d = { ...clean(f), secciones, sobre_pedido: sobrePedido }
    const { error } = m ? await supabase.from('materiales').update(d).eq('id', m.id) : await supabase.from('materiales').insert(d)
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
      <Field label="Código"><input className="input" value={f.codigo} onChange={set('codigo')} /></Field>
      <Field label="Tipo"><select className="input" value={f.tipo} onChange={set('tipo')}>{Object.entries(TIPOS_MATERIAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Descripción *" className="sm:col-span-2"><input className="input" required value={f.descripcion} onChange={set('descripcion')} /></Field>
      <Field label="Categoría"><input className="input" list="cats" value={f.categoria} onChange={set('categoria')} /></Field>
      <Field label="Unidad de medida"><UnidadSelect value={f.unidad} onChange={v => setF({ ...f, unidad: v })} /></Field>
      <Field label="Nivel mínimo"><input className="input" type="number" step="0.001" min="0" value={f.minimo} onChange={set('minimo')} /></Field>
      <Field label="Proveedor habitual"><select className="input" value={f.proveedor_id} onChange={set('proveedor_id')}><option value="">—</option>{proveedores.filter(p => p.activo !== false || String(p.id) === String(f.proveedor_id)).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={e => setF({ ...f, activo: e.target.checked })} /> Activo</label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={sobrePedido} onChange={e => setSobrePedido(e.target.checked)} /> Se compra sobre pedido (se entrega sin existencia; ej. color)</label>
      <Field grupo label="Aparece en la solicitud de material de la app de técnicos" className="sm:col-span-2">
        <div className="flex flex-wrap gap-4 text-sm">{([['hojalateria', 'Listado de hojalatería'], ['pintura', 'Listado de pintura']] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={secciones.includes(k)} onChange={e => setSecciones(e.target.checked ? [...secciones, k] : secciones.filter(x => x !== k))} /> {l}</label>
        ))}</div>
      </Field>
      <datalist id="cats">{['Pintura base', 'Barniz / transparente', 'Primer', 'Thinner / solventes', 'Lijas y abrasivos', 'Masillas', 'Cintas y enmascarado', 'Pulido', 'Refacciones de carrocería'].map(c => <option key={c} value={c} />)}</datalist>
      {!m && <p className="text-xs text-slate-500 sm:col-span-2">La existencia inicial se registra con “Ajustar” (inventario inicial) o al recibir una compra.</p>}
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
    </form>
  )
}

function Ajuste({ m, onDone }: { m: Material; onDone: () => void }) {
  const [ex, setEx] = useState(String(m.existencia))
  const [costo, setCosto] = useState(m.existencia > 0 ? '' : String(m.costo_promedio || ''))
  const [motivo, setMotivo] = useState(m.existencia > 0 ? '' : 'Inventario inicial')
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!confirm(`¿Ajustar existencia de ${num(m.existencia, 3)} a ${ex} ${m.unidad}? Quedará registrado con tu usuario.`)) return
    const { error } = await supabase.rpc('inventario_ajustar', { p_material: m.id, p_existencia: Number(ex), p_motivo: motivo, p_costo: costo ? Number(costo) : null })
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorMsg error={error} />
      <p className="text-sm">Existencia en sistema: <b>{num(m.existencia, 3)} {m.unidad}</b> · Costo promedio neto {money2(m.costo_promedio)} · con IVA {money2(m.costo_promedio * 1.16)}</p>
      <Field label="Existencia real (conteo físico) *"><input className="input" type="number" step="0.001" min="0" required value={ex} onChange={e => setEx(e.target.value)} /></Field>
      <Field label="Costo unitario neto (sin IVA)" hint={costo ? `Con IVA (16%): ${money2(Number(costo) * 1.16)}. Solo para inventario inicial o corrección de costo; vacío conserva el costo promedio.` : 'Captura el costo SIN IVA (precio con IVA ÷ 1.16). Vacío conserva el costo promedio.'}><input className="input" type="number" step="0.0001" min="0" value={costo} onChange={e => setCosto(e.target.value)} /></Field>
      <Field label="Motivo *"><input className="input" required value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Conteo físico mensual" /></Field>
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onDone}>Cancelar</button><button className="btn btn-primary">Aplicar ajuste</button></div>
    </form>
  )
}

export function TabMateriales() {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Material[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [q, setQ] = useState(''); const [tipo, setTipo] = useState(''); const [bajo, setBajo] = useState(false)
  const [modal, setModal] = useState<{ t: 'form' | 'ajuste'; m: Material | null } | null>(null)
  const cargar = useCallback(() => {
    supabase.from('materiales').select('*').order('descripcion').then(({ data }) => setRows((data ?? []) as Material[]))
    supabase.from('proveedores').select('*').order('nombre').then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
  }, [])
  useEffect(() => { cargar() }, [cargar])
  const s = q.toLowerCase()
  const lista = rows.filter(m => (!s || `${m.codigo} ${m.descripcion} ${m.categoria}`.toLowerCase().includes(s)) && (!tipo || m.tipo === tipo) && (!bajo || (!m.sobre_pedido && Number(m.existencia) <= Number(m.minimo))))
  const valor = rows.reduce((t, m) => t + Number(m.existencia) * Number(m.costo_promedio), 0)
  const prov = (id: number | null) => proveedores.find(p => p.id === id)?.nombre ?? '—'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-60" placeholder="Buscar código o descripción…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-auto" value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(TIPOS_MATERIAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={bajo} onChange={e => setBajo(e.target.checked)} /> Bajo mínimo</label>
        <span className="ml-auto text-sm text-slate-500">Valor del inventario: <b className="text-slate-900">{money2(valor)}</b> neto + IVA {money2(valor * 0.16)} = <b className="text-slate-900">{money2(valor * 1.16)}</b></span>
        <button className="btn btn-secondary btn-sm" onClick={() => descargarCSV('inventario', lista.map(m => ({ ...m, tipo: TIPOS_MATERIAL[m.tipo], valor: (Number(m.existencia) * Number(m.costo_promedio)).toFixed(2), proveedor: prov(m.proveedor_id) })), [
          { key: 'codigo', label: 'Código' }, { key: 'descripcion', label: 'Descripción' }, { key: 'tipo', label: 'Tipo' }, { key: 'categoria', label: 'Categoría' }, { key: 'unidad', label: 'Unidad' },
          { key: 'existencia', label: 'Existencia' }, { key: 'minimo', label: 'Mínimo' }, { key: 'costo_promedio', label: 'Costo promedio' }, { key: 'valor', label: 'Valor' }, { key: 'proveedor', label: 'Proveedor' },
        ])}><Download className="h-4 w-4" /> Excel</button>
        {puede('almacen.gestionar') && <button className="btn btn-primary btn-sm" onClick={() => setModal({ t: 'form', m: null })}><Plus className="h-4 w-4" /> Nuevo material</button>}
      </div>
      <Card pad={false}>
        {lista.length === 0 ? <Empty icon={Package}>Sin materiales</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Código</th><th>Descripción</th><th>Tipo / categoría</th><th className="text-right">Existencia</th><th className="text-right">Mínimo</th><th className="text-right">Costo neto</th><th className="text-right">IVA</th><th className="text-right">Con IVA</th><th>Proveedor</th><th></th></tr></thead>
            <tbody>{lista.map(m => {
              const b = !m.sobre_pedido && Number(m.existencia) <= Number(m.minimo)
              return (
                <tr key={m.id} className={m.activo ? '' : 'opacity-50'}>
                  <td className="font-mono text-xs">{m.codigo ?? '—'}</td><td className="font-medium">{m.descripcion}</td>
                  <td className="text-xs">{TIPOS_MATERIAL[m.tipo]}<div className="text-slate-500">{m.categoria}</div></td>
                  <td className={`text-right font-semibold ${b ? 'text-red-600' : ''}`}>{m.sobre_pedido ? <span className="text-xs font-semibold text-brand-700">Sobre pedido</span> : <>{num(m.existencia, 3)} {m.unidad}{b && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}</>}</td>
                  <td className="text-right text-slate-500">{num(m.minimo, 3)}</td><td className="text-right">{money2(m.costo_promedio)}</td><td className="text-right text-slate-500">{money2(m.costo_promedio * 0.16)}</td><td className="text-right font-semibold">{money2(m.costo_promedio * 1.16)}</td><td className="text-xs">{prov(m.proveedor_id)}</td>
                  <td className="whitespace-nowrap text-right">{puede('almacen.gestionar') && <>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ t: 'ajuste', m })}>Ajustar</button>{' '}
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ t: 'form', m })}>Editar</button></>}
                  </td>
                </tr>)
            })}</tbody>
          </table></div>
        )}
      </Card>
      {modal && <Modal title={modal.t === 'ajuste' ? 'Ajuste de inventario' : modal.m ? 'Editar material' : 'Nuevo material'} onClose={() => setModal(null)}>
        {modal.t === 'ajuste' && modal.m ? <Ajuste m={modal.m} onDone={() => { setModal(null); cargar() }} /> : <MaterialForm m={modal.m} proveedores={proveedores} onDone={() => { setModal(null); cargar() }} />}
      </Modal>}
    </div>
  )
}

/* ----------------------------- PINTURA ----------------------------- */
interface PinturaRow { orden_id: number; folio: string; tipo: string; etapa: string; cantidad_presupuestada: number; cantidad_real: number; costo_presupuestado: number; costo_real: number; diferencia: number; entregado_por: string | null }
export function TabPintura() {
  const [rows, setRows] = useState<PinturaRow[]>([])
  const [umbral, setUmbral] = useState(15)
  useEffect(() => { supabase.from('v_pintura').select('*').order('folio', { ascending: false }).then(({ data }) => setRows((data ?? []) as PinturaRow[])) }, [])
  const desv = (r: PinturaRow) => r.costo_presupuestado > 0 ? ((r.costo_real - r.costo_presupuestado) / r.costo_presupuestado) * 100 : null
  const fuera = rows.filter(r => { const d = desv(r); return d !== null && d > umbral })
  const sinPres = rows.filter(r => r.costo_presupuestado === 0 && r.costo_real > 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card !p-4"><div className="text-xs text-slate-500">Costo de pintura presupuestado</div><div className="text-xl font-extrabold">{money2(rows.reduce((s, r) => s + Number(r.costo_presupuestado), 0))}</div></div>
        <div className="card !p-4"><div className="text-xs text-slate-500">Costo de pintura real</div><div className="text-xl font-extrabold">{money2(rows.reduce((s, r) => s + Number(r.costo_real), 0))}</div></div>
        <div className="card !p-4"><div className="text-xs text-slate-500">Órdenes con consumo fuera de lo presupuestado (&gt;{umbral}%)</div><div className={`text-xl font-extrabold ${fuera.length ? 'text-red-600' : ''}`}>{fuera.length}</div>
          <label className="mt-1 flex items-center gap-1 text-xs text-slate-500">Umbral <input type="number" className="w-14 rounded border px-1" value={umbral} onChange={e => setUmbral(Number(e.target.value))} />%</label></div>
      </div>
      {sinPres.length > 0 && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{sinPres.length} orden(es) consumieron pintura sin tener pintura presupuestada: {sinPres.map(r => r.folio).join(', ')}.</div>}
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Paintbrush}>Sin consumos de pintura registrados</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Orden</th><th>Tipo</th><th className="text-right">Consumo pres.</th><th className="text-right">Consumo real</th><th className="text-right">Costo pres.</th><th className="text-right">Costo real</th><th className="text-right">Diferencia</th><th>Entregó</th></tr></thead>
            <tbody>{rows.map(r => { const d = desv(r); return (
              <tr key={r.orden_id}>
                <td><Link className="font-semibold text-brand-700 hover:underline" to={`/ordenes/${r.orden_id}?tab=materiales`}>{r.folio}</Link></td>
                <td className="text-xs">{r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'}</td>
                <td className="text-right">{num(r.cantidad_presupuestada, 3)}</td><td className="text-right">{num(r.cantidad_real, 3)}</td>
                <td className="text-right">{money2(r.costo_presupuestado)}</td><td className="text-right">{money2(r.costo_real)}</td>
                <td className={`text-right font-semibold ${d !== null && d > umbral ? 'text-red-600' : r.diferencia > 0 ? 'text-amber-700' : 'text-green-700'}`}>{money2(r.diferencia)}{d !== null && <div className="text-[11px]">{d > 0 ? '+' : ''}{d.toFixed(1)}%</div>}</td>
                <td className="text-xs">{r.entregado_por ?? '—'}</td>
              </tr>) })}</tbody>
          </table></div>
        )}
      </Card>
      <p className="text-xs text-slate-500">La desviación es información para revisión, no una conclusión: verifica unidades, ampliaciones y retrabajos antes de tomar decisiones.</p>
    </div>
  )
}

/* ----------------------------- COMPRAS ----------------------------- */
interface CompraRow { id: number; fecha: string; estado: string; factura: string | null; notas: string | null; proveedores?: { nombre: string } | null; compra_partidas: { cantidad: number; costo_unit: number; iva_pct: number }[] }
export function TabCompras() {
  const { puede } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [estado, setEstado] = useState(sp.get('estado') ?? 'abiertas')
  const [rows, setRows] = useState<CompraRow[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [nueva, setNueva] = useState(false)
  const [f, setF] = useState({ proveedor_id: '', fecha: hoyISO(), notas: '' })
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [errorLista, setErrorLista] = useState<string | null>(null)
  async function eliminar(c: CompraRow) {
    const folio = `REQ-${String(c.id).padStart(4, '0')}`
    if (!confirm(`¿Eliminar la requisición ${folio}${c.compra_partidas.length ? ` y sus ${c.compra_partidas.length} partida(s)` : ''}? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('compras').delete().eq('id', c.id)
    setErrorLista(error ? errorTexto(error) : null)
    if (!error) setRecarga(r => r + 1)
  }
  useEffect(() => {
    let q = supabase.from('compras').select('*, proveedores(nombre), compra_partidas(cantidad,costo_unit,iva_pct)').order('fecha', { ascending: false }).limit(500)
    if (estado === 'abiertas') q = q.in('estado', ['requisicion', 'por_autorizar', 'autorizada'])
    else if (estado !== 'todas') q = q.eq('estado', estado)
    q.then(({ data }) => setRows((data ?? []) as CompraRow[]))
    supabase.from('proveedores').select('*').order('nombre').then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
  }, [estado, recarga])
  async function crear(e: FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('compras').insert(clean(f)).select('id').single()
    if (error) return setError(errorTexto(error))
    nav(`/compras/${data.id}`)
  }
  const total = (c: CompraRow) => c.compra_partidas.reduce((s, p) => s + p.cantidad * p.costo_unit * (1 + Number(p.iva_pct ?? 0) / 100), 0)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        {[['abiertas', 'Abiertas'], ...Object.entries(ESTADO_COMPRA).map(([k, v]) => [k, v.label]), ['todas', 'Todas']].map(([k, l]) => (
          <button key={k} onClick={() => setEstado(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${estado === k ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        {puede('compras.gestionar') && <button className="btn btn-primary btn-sm ml-auto" onClick={() => setNueva(true)}><Plus className="h-4 w-4" /> Nueva requisición</button>}
      </div>
      <ErrorMsg error={errorLista} />
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={ShoppingCart}>Sin compras</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Folio</th><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Estado</th><th className="text-right">Partidas</th><th className="text-right">Total con IVA</th><th></th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/compras/${c.id}`)}>
                <td className="font-bold">REQ-{String(c.id).padStart(4, '0')}</td><td>{fecha(c.fecha)}</td><td>{c.proveedores?.nombre ?? '—'}</td><td>{c.factura ?? '—'}</td>
                <td><Badge cls={ESTADO_COMPRA[c.estado].badge}>{ESTADO_COMPRA[c.estado].label}</Badge></td>
                <td className="text-right">{c.compra_partidas.length}</td><td className="text-right font-semibold">{money2(total(c))}</td>
                <td className="text-right">{['requisicion', 'cancelada'].includes(c.estado) && puede('compras.gestionar') &&
                  <button className="btn btn-ghost btn-sm text-red-600" title="Eliminar requisición" onClick={e => { e.stopPropagation(); eliminar(c) }}><Trash2 className="h-4 w-4" /> Eliminar</button>}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {nueva && <Modal title="Nueva requisición" onClose={() => setNueva(false)}>
        <form onSubmit={crear} className="space-y-3">
          <ErrorMsg error={error} />
          <Field label="Proveedor (puede definirse después de cotizar)"><select className="input" value={f.proveedor_id} onChange={e => setF({ ...f, proveedor_id: e.target.value })}><option value="">—</option>{proveedores.filter(p => p.activo !== false || String(p.id) === String(f.proveedor_id)).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
          <Field label="Fecha"><input className="input" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Notas / justificación"><textarea className="input" rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={() => setNueva(false)}>Cancelar</button><button className="btn btn-primary">Crear y agregar partidas</button></div>
        </form>
      </Modal>}
    </div>
  )
}

/* ----------------------------- PROVEEDORES ----------------------------- */
export function TabProveedores() {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Proveedor[]>([])
  const [edit, setEdit] = useState<Proveedor | 'nuevo' | null>(null)
  const [f, setF] = useState({ nombre: '', contacto: '', telefono: '', email: '', rfc: '' })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const cargar = () => supabase.from('proveedores').select('*').order('activo', { ascending: false }).order('nombre').then(({ data }) => setRows((data ?? []) as Proveedor[]))
  useEffect(() => { cargar() }, [])
  const abrir = (p: Proveedor | 'nuevo') => { setEdit(p); setError(null); setF(p === 'nuevo' ? { nombre: '', contacto: '', telefono: '', email: '', rfc: '' } : { nombre: p.nombre, contacto: p.contacto ?? '', telefono: p.telefono ?? '', email: p.email ?? '', rfc: p.rfc ?? '' }) }
  async function guardar(e: FormEvent) {
    e.preventDefault()
    const { error } = edit === 'nuevo' ? await supabase.from('proveedores').insert(clean(f)) : await supabase.from('proveedores').update(clean(f)).eq('id', (edit as Proveedor).id)
    if (error) return setError(errorTexto(error))
    setEdit(null); cargar()
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  async function eliminar(p: Proveedor) {
    if (!confirm(`¿Eliminar al proveedor ${p.nombre.trim()}?`)) return
    setError(null)
    const { error } = await supabase.from('proveedores').delete().eq('id', p.id)
    if (!error) { setAviso(`Proveedor ${p.nombre.trim()} eliminado.`); return cargar() }
    if (error.code !== '23503') return setAviso(errorTexto(error))
    // Tiene compras, cotizaciones o trabajos registrados: no se borra para no perder ese historial; se da de baja
    if (!confirm(`${p.nombre.trim()} tiene compras, cotizaciones o trabajos registrados, por eso no se puede borrar sin perder ese historial.\n\n¿Darlo de baja? Ya no aparecerá para nuevas compras ni trabajos, y su historial se conserva.`)) return
    const r = await supabase.from('proveedores').update({ activo: false }).eq('id', p.id)
    setAviso(r.error ? errorTexto(r.error) : `Proveedor ${p.nombre.trim()} dado de baja (su historial se conserva).`); cargar()
  }
  async function reactivar(p: Proveedor) {
    const r = await supabase.from('proveedores').update({ activo: true }).eq('id', p.id)
    setAviso(r.error ? errorTexto(r.error) : null); cargar()
  }
  return (
    <div className="space-y-3">
      {aviso && <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-800 ring-1 ring-brand-200"><span>{aviso}</span><button className="font-semibold" onClick={() => setAviso(null)}>×</button></div>}
      {puede('compras.gestionar') && <div className="flex justify-end"><button className="btn btn-primary btn-sm" onClick={() => abrir('nuevo')}><Plus className="h-4 w-4" /> Nuevo proveedor</button></div>}
      <Card pad={false}>
        {rows.length === 0 ? <Empty>Sin proveedores</Empty> : (
          <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>RFC</th><th></th></tr></thead>
            <tbody>{rows.map(p => <tr key={p.id} className={p.activo === false ? 'opacity-60' : ''}><td className="font-medium">{p.nombre}{p.activo === false && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">De baja</span>}</td><td>{p.contacto ?? '—'}</td><td>{p.telefono ?? '—'}</td><td>{p.email ?? '—'}</td><td>{p.rfc ?? '—'}</td>
              <td className="whitespace-nowrap text-right">{puede('compras.gestionar') && <div className="inline-flex gap-1.5">
                <button className="btn btn-secondary btn-sm" onClick={() => abrir(p)}>Editar</button>
                {p.activo === false
                  ? <button className="btn btn-secondary btn-sm" onClick={() => reactivar(p)}>Reactivar</button>
                  : <button className="btn btn-ghost btn-sm text-red-600" title="Eliminar proveedor" onClick={() => eliminar(p)}><Trash2 className="h-4 w-4" /> Eliminar</button>}
              </div>}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
      {edit && <Modal title={edit === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={() => setEdit(null)}>
        <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><ErrorMsg error={error} /></div>
          <Field label="Nombre *" className="sm:col-span-2"><input className="input" required value={f.nombre} onChange={set('nombre')} /></Field>
          <Field label="Contacto"><input className="input" value={f.contacto} onChange={set('contacto')} /></Field>
          <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set('telefono')} /></Field>
          <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="RFC"><input className="input" value={f.rfc} onChange={set('rfc')} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary">Guardar</button></div>
        </form>
      </Modal>}
    </div>
  )
}

/* ----------------------------- MOVIMIENTOS Y PRECIOS ----------------------------- */
interface Mov { id: number; fecha: string; tipo: string; cantidad: number; costo_unit: number; existencia_resultante: number; motivo: string | null; orden_id: number | null; compra_id: number | null; materiales?: { descripcion: string; unidad: string }; ordenes?: { folio: string } | null; perfiles?: { nombre: string } | null }
export function TabMovimientos() {
  const [movs, setMovs] = useState<Mov[]>([])
  useEffect(() => {
    supabase.from('movimientos_inventario').select('*, materiales(descripcion,unidad), ordenes(folio), perfiles(nombre)').order('fecha', { ascending: false }).limit(300).then(({ data }) => setMovs((data ?? []) as Mov[]))
  }, [])
  return (
    <div className="space-y-5">
      <Card title="Movimientos de inventario (últimos 300)" action={<button className="btn btn-secondary btn-sm" onClick={() => descargarCSV('movimientos_inventario', movs.map(m => ({ ...m, material: m.materiales?.descripcion, unidad: m.materiales?.unidad, orden: m.ordenes?.folio, usuario: m.perfiles?.nombre })), [
        { key: 'fecha', label: 'Fecha' }, { key: 'material', label: 'Material' }, { key: 'tipo', label: 'Tipo' }, { key: 'cantidad', label: 'Cantidad' }, { key: 'unidad', label: 'Unidad' },
        { key: 'costo_unit', label: 'Costo unit.' }, { key: 'existencia_resultante', label: 'Existencia resultante' }, { key: 'orden', label: 'Orden' }, { key: 'motivo', label: 'Motivo' }, { key: 'usuario', label: 'Usuario' },
      ])}><Download className="h-4 w-4" /> Excel</button>}>
        {movs.length === 0 ? <Empty icon={ArrowLeftRight}>Sin movimientos</Empty> : (
          <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
            <thead><tr><th>Fecha</th><th>Material</th><th>Tipo</th><th className="text-right">Cantidad</th><th className="text-right">Costo</th><th className="text-right">Existencia</th><th>Referencia</th><th>Usuario</th></tr></thead>
            <tbody>{movs.map(m => (
              <tr key={m.id}>
                <td className="text-xs whitespace-nowrap">{fechaHora(m.fecha)}</td><td>{m.materiales?.descripcion}</td>
                <td><span className={m.tipo === 'entrada' ? 'text-green-700' : m.tipo === 'salida' ? 'text-red-600' : 'text-amber-700'}>{m.tipo}</span></td>
                <td className="text-right">{num(m.cantidad, 3)} {m.materiales?.unidad}</td><td className="text-right">{money2(m.costo_unit)}</td><td className="text-right">{num(m.existencia_resultante, 3)}</td>
                <td className="text-xs">{m.motivo}{m.orden_id && <> · <Link className="text-brand-700" to={`/ordenes/${m.orden_id}?tab=materiales`}>{m.ordenes?.folio}</Link></>}{m.compra_id && <> · <Link className="text-brand-700" to={`/compras/${m.compra_id}`}>REQ-{String(m.compra_id).padStart(4, '0')}</Link></>}</td>
                <td className="text-xs">{m.perfiles?.nombre ?? '—'}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}
