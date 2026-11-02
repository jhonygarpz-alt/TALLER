import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, History, ShoppingCart, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAlertas } from '../../lib/alertas'
import { fecha, money2 } from '../../lib/format'
import { descargarCSV } from '../../lib/exportar'
import { Badge, Card, Empty, PageHeader, Tabs, useTab } from '../../components/ui'
import { TabCompras, TabProveedores } from '../compras/inventario'

interface Precio {
  id: number; material_id: number; fecha: string; costo_unit: number; costo_anterior: number | null; compra_id: number | null
  materiales?: { codigo: string | null; descripcion: string; unidad: string }; proveedores?: { nombre: string } | null
}

function HistorialPrecios() {
  const [rows, setRows] = useState<Precio[]>([])
  const [q, setQ] = useState('')
  const [umbral, setUmbral] = useState(10)
  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'precio_alerta_pct').maybeSingle().then(({ data }) => data && setUmbral(Number(data.valor)))
    supabase.from('precios_historial').select('*, materiales(codigo,descripcion,unidad), proveedores(nombre)').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []) as Precio[]))
  }, [])
  const s = q.toLowerCase()
  const lista = useMemo(() => rows.filter(r => !s || `${r.materiales?.codigo} ${r.materiales?.descripcion} ${r.proveedores?.nombre}`.toLowerCase().includes(s)), [rows, s])
  const variacion = (r: Precio) => r.costo_anterior && r.costo_anterior > 0 ? ((r.costo_unit / r.costo_anterior) - 1) * 100 : null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-72" placeholder="Material o proveedor…" value={q} onChange={e => setQ(e.target.value)} />
        <span className="text-xs text-slate-500">Se marca en rojo un aumento mayor a {umbral}% (parámetro configurable en Administración).</span>
        <button className="btn btn-secondary btn-sm ml-auto" onClick={() => descargarCSV('historial_precios', lista.map(r => ({ fecha: r.fecha, codigo: r.materiales?.codigo, material: r.materiales?.descripcion, proveedor: r.proveedores?.nombre, costo: r.costo_unit, anterior: r.costo_anterior, variacion: variacion(r)?.toFixed(1) })))}><Download className="h-4 w-4" /> Excel</button>
      </div>
      <Card pad={false}>
        {lista.length === 0 ? <Empty icon={History}>Sin precios registrados. Se registran automáticamente al recibir cada compra.</Empty> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Fecha</th><th>Material</th><th>Proveedor</th><th className="text-right">Precio anterior</th><th className="text-right">Precio</th><th className="text-right">Variación</th><th>Compra</th></tr></thead>
            <tbody>{lista.map(r => {
              const v = variacion(r)
              return (
                <tr key={r.id}>
                  <td>{fecha(r.fecha)}</td>
                  <td className="font-medium">{r.materiales?.descripcion}<div className="text-xs text-slate-500">{r.materiales?.codigo} · {r.materiales?.unidad}</div></td>
                  <td>{r.proveedores?.nombre ?? '—'}</td>
                  <td className="text-right text-slate-500">{r.costo_anterior ? money2(r.costo_anterior) : '—'}</td>
                  <td className="text-right font-semibold">{money2(r.costo_unit)}</td>
                  <td className="text-right">{v === null ? '—' : <Badge cls={v > umbral ? 'bg-red-100 text-red-700' : v > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</Badge>}</td>
                  <td>{r.compra_id && <Link className="text-brand-700 hover:underline" to={`/compras/${r.compra_id}`}>REQ-{String(r.compra_id).padStart(4, '0')}</Link>}</td>
                </tr>)
            })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  )
}

export default function Compras() {
  const al = useAlertas()
  const tab = useTab('compras')
  return (
    <div>
      <PageHeader title="Compras" subtitle="Solicitudes de compra, cotizaciones, autorización, recepción y facturas de proveedor" />
      <Tabs tabs={[
        { id: 'compras', label: 'Solicitudes y órdenes de compra', icon: ShoppingCart, count: al.comprasPorAutorizar },
        { id: 'proveedores', label: 'Proveedores', icon: Truck },
        { id: 'precios', label: 'Historial de precios', icon: History },
      ]} />
      {tab === 'compras' && <TabCompras />}
      {tab === 'proveedores' && <TabProveedores />}
      {tab === 'precios' && <HistorialPrecios />}
    </div>
  )
}
