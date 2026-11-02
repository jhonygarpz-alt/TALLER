import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Download, FilePlus2, FileText, Hourglass, Paperclip, Printer, Receipt, Scale } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { usePeriodo } from '../../lib/periodo'
import { urlFirmada } from '../../lib/storage'
import { ETAPAS, errorTexto, fecha, hoyISO, money2 } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import type { Rentabilidad } from '../../lib/tipos'
import { Badge, Card, Empty, ErrorMsg, Field, Modal, PageHeader, Pendiente, SinPermiso, Tabs, useTab } from '../../components/ui'
import PeriodoSelect from '../../components/PeriodoSelect'

interface Cxc {
  id: number; orden_id: number; orden_folio: string; folio: string; fecha: string; fecha_vencimiento: string; receptor: string; monto: number
  pagado: number; saldo: number; dias_vencido: number; deudor: string; tipo: string; cliente_id: number; aseguradora_id: number | null
  archivo_path: string | null; estado_cfdi: string; uuid_cfdi: string | null
}

async function subirDocumento(facturaId: number, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `facturas/${facturaId}/${Date.now()}.${ext}`
  const up = await supabase.storage.from('evidencias').upload(path, file, { contentType: file.type || 'application/pdf' })
  if (up.error) throw up.error
  const { error } = await supabase.from('facturas').update({ archivo_path: path }).eq('id', facturaId)
  if (error) throw error
}

function NuevaFactura({ r, onDone }: { r: Rentabilidad & { saldo_facturar: number }; onDone: () => void }) {
  const [f, setF] = useState({ folio: '', receptor: r.tipo === 'aseguradora' ? 'aseguradora' : 'cliente', monto: r.saldo_facturar.toFixed(2), fecha: hoyISO() })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { data, error } = await supabase.from('facturas').insert({ orden_id: r.orden_id, folio: f.folio.trim(), receptor: f.receptor, monto: Number(f.monto), fecha: f.fecha }).select('id').single()
    if (error) { setEnviando(false); return setError(errorTexto(error)) }
    if (archivo) { try { await subirDocumento(data.id, archivo) } catch (e2) { setEnviando(false); return setError('Factura registrada, pero el documento no se pudo adjuntar: ' + errorTexto(e2)) } }
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorMsg error={error} />
      <p className="text-sm">Orden <b>{r.folio}</b> · Ingreso reconocido {money2(r.ingreso_reconocido)} · Ya facturado {money2(r.facturado)}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Folio / serie *"><input className="input" required value={f.folio} onChange={e => setF({ ...f, folio: e.target.value })} /></Field>
        <Field label="Receptor"><select className="input" value={f.receptor} onChange={e => setF({ ...f, receptor: e.target.value })}><option value="aseguradora" disabled={r.tipo !== 'aseguradora'}>Aseguradora</option><option value="cliente">Cliente</option></select></Field>
        <Field label="Importe *"><input className="input" type="number" step="0.01" min="0.01" required value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} /></Field>
        <Field label="Fecha"><input className="input" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
      </div>
      <Field label="Documento (PDF / XML)" hint="El vencimiento se calcula con los días de crédito del cliente o aseguradora."><input className="input" type="file" accept="application/pdf,image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} /></Field>
      <div className="flex justify-end"><button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar factura'}</button></div>
    </form>
  )
}

function RegistrarPago({ c, onDone }: { c: Cxc; onDone: () => void }) {
  const [f, setF] = useState({ monto: Number(c.saldo).toFixed(2), metodo: 'transferencia', referencia: '', fecha: hoyISO() })
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (Number(f.monto) > Number(c.saldo) + 0.005 && !confirm('El pago es mayor al saldo de la factura. ¿Registrar de todas formas?')) return
    const { error } = await supabase.from('cobros').insert({ orden_id: c.orden_id, factura_id: c.id, monto: Number(f.monto), metodo: f.metodo, referencia: f.referencia || null, fecha: f.fecha })
    if (error) return setError(errorTexto(error))
    onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <ErrorMsg error={error} />
      <p className="text-sm">Factura <b>{c.folio}</b> · {c.deudor} · Saldo <b>{money2(c.saldo)}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto *"><input className="input" type="number" step="0.01" min="0.01" required value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} /></Field>
        <Field label="Método"><select className="input" value={f.metodo} onChange={e => setF({ ...f, metodo: e.target.value })}>{['transferencia', 'efectivo', 'tarjeta', 'cheque', 'deducible'].map(m => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}</select></Field>
        <Field label="Fecha"><input className="input" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
        <Field label="Referencia"><input className="input" value={f.referencia} onChange={e => setF({ ...f, referencia: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end"><button className="btn btn-success">Registrar pago</button></div>
    </form>
  )
}

function PorFacturar({ onCambio }: { onCambio: () => void }) {
  const { puede } = useAuth()
  const [rows, setRows] = useState<(Rentabilidad & { saldo_facturar: number })[]>([])
  const [sel, setSel] = useState<(Rentabilidad & { saldo_facturar: number }) | null>(null)
  const cargar = useCallback(() => {
    supabase.from('v_rentabilidad').select('*').in('etapa', ['listo_entrega', 'entregado']).gt('ingreso_reconocido', 0).order('folio')
      .then(({ data }) => setRows(((data ?? []) as Rentabilidad[]).map(r => ({ ...r, saldo_facturar: Number(r.ingreso_reconocido) - Number(r.facturado) })).filter(r => r.saldo_facturar > 0.005)))
  }, [])
  useEffect(() => { cargar() }, [cargar])
  return (
    <Card title={`Documentos pendientes de facturación (${rows.length})`} action={<span className="text-lg font-extrabold">{money2(rows.reduce((s, r) => s + r.saldo_facturar, 0))}</span>}>
      {rows.length === 0 ? <Empty icon={FileText}>Todas las órdenes terminadas están facturadas</Empty> : (
        <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
          <thead><tr><th>Orden</th><th>Tipo</th><th>Etapa</th><th className="text-right">Ingreso autorizado</th><th className="text-right">Facturado</th><th className="text-right">Por facturar</th><th></th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.orden_id}><td><Link className="font-bold text-blue-600" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.folio}</Link></td>
              <td className="text-xs">{r.tipo === 'aseguradora' ? 'Aseguradora' : 'Particular'}</td><td><Badge cls={ETAPAS[r.etapa].badge}>{ETAPAS[r.etapa].label}</Badge></td>
              <td className="text-right">{money2(r.ingreso_reconocido)}</td><td className="text-right">{money2(r.facturado)}</td><td className="text-right font-bold text-amber-700">{money2(r.saldo_facturar)}</td>
              <td className="text-right">{puede('finanzas.gestionar') && <button className="btn btn-primary btn-sm" onClick={() => setSel(r)}><FilePlus2 className="h-4 w-4" /> Facturar</button>}</td></tr>))}
          </tbody>
        </table></div>
      )}
      {sel && <Modal title="Registrar factura" onClose={() => setSel(null)}><NuevaFactura r={sel} onDone={() => { setSel(null); cargar(); onCambio() }} /></Modal>}
    </Card>
  )
}

function Facturas({ version, onCambio }: { version: number; onCambio: () => void }) {
  const { puede } = useAuth()
  const [rows, setRows] = useState<Cxc[]>([])
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'vencidas' | 'pagadas'>('pendientes')
  const [pago, setPago] = useState<Cxc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cargar = useCallback(() => supabase.from('v_cuentas_cobrar').select('*').order('fecha', { ascending: false }).then(({ data }) => setRows((data ?? []) as Cxc[])), [])
  useEffect(() => { cargar() }, [cargar, version])
  const lista = rows.filter(r => filtro === 'todas' || (filtro === 'pendientes' && r.saldo > 0.005) || (filtro === 'vencidas' && r.saldo > 0.005 && r.dias_vencido > 0) || (filtro === 'pagadas' && r.saldo <= 0.005))
  async function adjuntar(c: Cxc, file?: File) {
    if (!file) return
    try { await subirDocumento(c.id, file); setError(null); cargar() } catch (e) { setError(errorTexto(e)) }
  }
  async function verDoc(path: string) { const u = await urlFirmada(path); if (u) window.open(u, '_blank') }
  async function cancelar(c: Cxc) {
    if (!confirm(`¿Cancelar la factura ${c.folio}? Quedará registrada en auditoría y dejará de contar como facturado.`)) return
    const { error } = await supabase.from('facturas').update({ cancelada: true }).eq('id', c.id)
    setError(error ? errorTexto(error) : null); cargar(); onCambio()
  }
  return (
    <div className="space-y-3">
      <ErrorMsg error={error} />
      <div className="flex flex-wrap items-center gap-1">
        {([['pendientes', 'Con saldo'], ['vencidas', 'Vencidas'], ['pagadas', 'Pagadas'], ['todas', 'Todas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtro === k ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('facturas', lista as unknown as Record<string, unknown>[], [
          { key: 'folio', label: 'Factura' }, { key: 'orden_folio', label: 'Orden' }, { key: 'deudor', label: 'Deudor' }, { key: 'receptor', label: 'Receptor' }, { key: 'fecha', label: 'Fecha' },
          { key: 'fecha_vencimiento', label: 'Vencimiento' }, { key: 'monto', label: 'Importe' }, { key: 'pagado', label: 'Pagado' }, { key: 'saldo', label: 'Saldo' }, { key: 'dias_vencido', label: 'Días vencido' }, { key: 'estado_cfdi', label: 'CFDI' }])}><Download className="h-4 w-4" /> Excel</button>
      </div>
      <Card pad={false}>
        {lista.length === 0 ? <Empty icon={Receipt}>Sin facturas con este filtro</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Factura</th><th>Orden</th><th>Deudor</th><th>Fecha</th><th>Vencimiento</th><th className="text-right">Importe</th><th className="text-right">Pagado</th><th className="text-right">Saldo</th><th>CFDI</th><th></th></tr></thead>
            <tbody>{lista.map(c => {
              const vencida = c.saldo > 0.005 && c.dias_vencido > 0
              return (
                <tr key={c.id}>
                  <td className="font-semibold">{c.folio}{c.archivo_path && <button className="ml-1 text-blue-600" title="Ver documento" onClick={() => verDoc(c.archivo_path!)}><Paperclip className="inline h-3.5 w-3.5" /></button>}</td>
                  <td><Link className="text-blue-600" to={`/ordenes/${c.orden_id}?tab=costos`}>{c.orden_folio}</Link></td>
                  <td>{c.deudor}<div className="text-xs text-slate-500">{c.receptor === 'aseguradora' ? 'Aseguradora' : 'Cliente'}</div></td>
                  <td>{fecha(c.fecha)}</td>
                  <td className={vencida ? 'font-semibold text-red-600' : ''}>{fecha(c.fecha_vencimiento)}{vencida && <div className="text-[11px]">Vencida hace {c.dias_vencido} d</div>}</td>
                  <td className="text-right">{money2(c.monto)}</td><td className="text-right text-green-700">{money2(c.pagado)}</td>
                  <td className={`text-right font-bold ${c.saldo > 0.005 ? 'text-red-600' : 'text-green-700'}`}>{money2(c.saldo)}</td>
                  <td><Badge cls="bg-slate-100 text-slate-500">Sin timbrar</Badge></td>
                  <td className="whitespace-nowrap text-right">
                    {puede('finanzas.gestionar') && <>
                      {c.saldo > 0.005 && <button className="btn btn-success btn-sm" onClick={() => setPago(c)}><Banknote className="h-3.5 w-3.5" /> Pago</button>}{' '}
                      <label className="btn btn-secondary btn-sm cursor-pointer" title="Adjuntar PDF/XML"><Paperclip className="h-3.5 w-3.5" /><input type="file" hidden accept="application/pdf,image/*" onChange={e => adjuntar(c, e.target.files?.[0])} /></label>{' '}
                      {c.pagado === 0 && <button className="btn btn-ghost btn-sm text-red-600" onClick={() => cancelar(c)}>Cancelar</button>}
                    </>}
                  </td>
                </tr>)
            })}</tbody>
          </table></div>
        )}
      </Card>
      {pago && <Modal title="Registrar pago recibido" onClose={() => setPago(null)}><RegistrarPago c={pago} onDone={() => { setPago(null); cargar(); onCambio() }} /></Modal>}
    </div>
  )
}

function CuentasPorCobrar({ version }: { version: number }) {
  const [rows, setRows] = useState<Cxc[]>([])
  useEffect(() => { supabase.from('v_cuentas_cobrar').select('*').gt('saldo', 0).then(({ data }) => setRows((data ?? []) as Cxc[])) }, [version])
  const tramos = [
    { l: 'Por vencer', f: (d: number) => d <= 0 }, { l: '1 a 30 días', f: (d: number) => d > 0 && d <= 30 }, { l: '31 a 60 días', f: (d: number) => d > 30 && d <= 60 },
    { l: '61 a 90 días', f: (d: number) => d > 60 && d <= 90 }, { l: 'Más de 90 días', f: (d: number) => d > 90 },
  ]
  const deudores = useMemo(() => Object.entries(rows.reduce<Record<string, Cxc[]>>((acc, r) => { (acc[r.deudor] ??= []).push(r); return acc }, {})).sort((a, b) => b[1].reduce((s, x) => s + Number(x.saldo), 0) - a[1].reduce((s, x) => s + Number(x.saldo), 0)), [rows])
  const total = rows.reduce((s, r) => s + Number(r.saldo), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="card !p-4"><div className="text-xs text-slate-500">Total por cobrar</div><div className="text-xl font-extrabold text-red-600">{money2(total)}</div></div>
        {tramos.map(t => { const v = rows.filter(r => t.f(r.dias_vencido)).reduce((s, r) => s + Number(r.saldo), 0); return <div key={t.l} className="card !p-4"><div className="text-xs text-slate-500">{t.l}</div><div className={`text-xl font-extrabold ${v && t.l !== 'Por vencer' ? 'text-amber-700' : ''}`}>{money2(v)}</div></div> })}
      </div>
      <Card title="Antigüedad de saldos por deudor">
        {deudores.length === 0 ? <Empty icon={Scale}>Sin cuentas por cobrar</Empty> : (
          <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
            <thead><tr><th>Deudor</th><th className="text-right">Facturas</th>{tramos.map(t => <th key={t.l} className="text-right">{t.l}</th>)}<th className="text-right">Saldo</th></tr></thead>
            <tbody>{deudores.map(([d, fs]) => (
              <tr key={d}><td className="font-medium">{d}</td><td className="text-right">{fs.length}</td>
                {tramos.map(t => { const v = fs.filter(r => t.f(r.dias_vencido)).reduce((s, r) => s + Number(r.saldo), 0); return <td key={t.l} className="text-right">{v ? money2(v) : '—'}</td> })}
                <td className="text-right font-bold">{money2(fs.reduce((s, r) => s + Number(r.saldo), 0))}</td></tr>))}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

interface Cobro { id: number; fecha: string; monto: number; metodo: string; referencia: string | null; orden_id: number; ordenes: { folio: string }; facturas: { folio: string } | null }
function Pagos({ version }: { version: number }) {
  const per = usePeriodo('mes')
  const [rows, setRows] = useState<Cobro[]>([])
  useEffect(() => { supabase.from('cobros').select('*, ordenes(folio), facturas(folio)').gte('fecha', per.desde).lt('fecha', per.hasta).order('fecha', { ascending: false }).then(({ data }) => setRows((data ?? []) as Cobro[])) }, [per.desde, per.hasta, version])
  const porMetodo = rows.reduce<Record<string, number>>((acc, r) => { acc[r.metodo] = (acc[r.metodo] ?? 0) + Number(r.monto); return acc }, {})
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3"><PeriodoSelect periodo={per.periodo} setPeriodo={per.setPeriodo} texto={per.texto} />
        <span className="text-sm">Total cobrado: <b className="text-green-700">{money2(rows.reduce((s, r) => s + Number(r.monto), 0))}</b></span>
        {Object.entries(porMetodo).map(([m, v]) => <Badge key={m} cls="bg-slate-100 text-slate-700">{m}: {money2(v)}</Badge>)}
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty icon={Banknote}>Sin pagos en el periodo</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Fecha</th><th>Orden</th><th>Factura</th><th>Método</th><th>Referencia</th><th className="text-right">Monto</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.id}><td>{fecha(r.fecha)}</td><td><Link className="text-blue-600" to={`/ordenes/${r.orden_id}?tab=costos`}>{r.ordenes.folio}</Link></td><td>{r.facturas?.folio ?? '—'}</td><td className="capitalize">{r.metodo}</td><td>{r.referencia ?? '—'}</td><td className="text-right font-semibold">{money2(r.monto)}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

function EstadosCuenta({ version }: { version: number }) {
  const [rows, setRows] = useState<Cxc[]>([])
  const [deudor, setDeudor] = useState('')
  const [pagos, setPagos] = useState<Cobro[]>([])
  useEffect(() => { supabase.from('v_cuentas_cobrar').select('*').order('fecha').then(({ data }) => setRows((data ?? []) as Cxc[])) }, [version])
  const deudores = [...new Set(rows.map(r => r.deudor))].sort()
  const facturas = rows.filter(r => r.deudor === deudor)
  useEffect(() => {
    if (!facturas.length) { setPagos([]); return }
    supabase.from('cobros').select('*, ordenes(folio), facturas(folio)').in('factura_id', facturas.map(f => f.id)).order('fecha').then(({ data }) => setPagos((data ?? []) as Cobro[]))
  }, [deudor, rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const movs = [...facturas.map(f => ({ fecha: f.fecha, concepto: `Factura ${f.folio} · ${f.orden_folio}`, cargo: Number(f.monto), abono: 0 })),
    ...pagos.map(p => ({ fecha: p.fecha, concepto: `Pago ${p.metodo}${p.referencia ? ' · ' + p.referencia : ''} (${p.facturas?.folio})`, cargo: 0, abono: Number(p.monto) }))].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let saldo = 0
  return (
    <Card title="Estado de cuenta" action={deudor && <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</button>}>
      <select className="input mb-4 w-auto" value={deudor} onChange={e => setDeudor(e.target.value)}>
        <option value="">Selecciona cliente o aseguradora…</option>{deudores.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {!deudor ? <p className="text-sm text-slate-400">Elige un deudor para ver sus cargos, abonos y saldo.</p> : (
        <div className="-mx-5 overflow-x-auto px-5"><table className="tbl">
          <thead><tr><th>Fecha</th><th>Concepto</th><th className="text-right">Cargo</th><th className="text-right">Abono</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>{movs.map((m, i) => { saldo += m.cargo - m.abono; return <tr key={i}><td>{fecha(m.fecha)}</td><td>{m.concepto}</td><td className="text-right">{m.cargo ? money2(m.cargo) : ''}</td><td className="text-right text-green-700">{m.abono ? money2(m.abono) : ''}</td><td className="text-right font-semibold">{money2(saldo)}</td></tr> })}</tbody>
          <tfoot><tr><td colSpan={4} className="text-right font-bold">Saldo actual</td><td className={`text-right text-lg font-extrabold ${saldo > 0 ? 'text-red-600' : 'text-green-700'}`}>{money2(saldo)}</td></tr></tfoot>
        </table></div>
      )}
    </Card>
  )
}

export default function Facturacion() {
  const { puede } = useAuth()
  const tab = useTab('pendientes')
  const [version, setVersion] = useState(0)
  if (!puede('finanzas.ver')) return <SinPermiso que="facturación y cobranza" />
  const cambio = () => setVersion(v => v + 1)
  return (
    <div>
      <PageHeader title="Facturación y cobranza" subtitle="Facturas, vencimientos, pagos y saldos por cliente o aseguradora" />
      <div className="mb-4"><Pendiente>Emisión y timbrado de CFDI 4.0. Hoy se registran facturas emitidas en tu sistema de facturación (folio, importe y PDF/XML). La base de datos ya guarda RFC, régimen, C.P., uso de CFDI y UUID para la integración futura.</Pendiente></div>
      <Tabs tabs={[
        { id: 'pendientes', label: 'Por facturar', icon: Hourglass },
        { id: 'facturas', label: 'Facturas', icon: Receipt },
        { id: 'cxc', label: 'Cuentas por cobrar', icon: Scale },
        { id: 'pagos', label: 'Pagos recibidos', icon: Banknote },
        { id: 'estados', label: 'Estados de cuenta', icon: FileText },
      ]} />
      {tab === 'pendientes' && <PorFacturar onCambio={cambio} />}
      {tab === 'facturas' && <Facturas version={version} onCambio={cambio} />}
      {tab === 'cxc' && <CuentasPorCobrar version={version} />}
      {tab === 'pagos' && <Pagos version={version} />}
      {tab === 'estados' && <EstadosCuenta version={version} />}
    </div>
  )
}
