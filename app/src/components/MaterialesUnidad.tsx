import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hammer, PaintBucket, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SECCIONES_MAT, fecha, money2, num, seccionPorTipo } from '../lib/format'

type Seccion = 'hojalateria' | 'pintura' | 'refaccion'
interface Linea { seccion: Seccion; descripcion: string; cantidad: string; importe: number; origen: string; estado: 'real' | 'pendiente'; fecha: string | null; link?: string }

/** Clasifica una entrega de material en su sección (misma regla del reporte de gastos económicos) */
export function seccionDeSolicitud(s: { seccion?: string | null; materiales?: { tipo?: string } | null; actividades?: { area?: string } | null }): Seccion {
  if (s.seccion) return s.seccion as Seccion
  if (s.materiales?.tipo === 'refaccion') return 'refaccion'
  if (s.materiales?.tipo === 'pintura' || s.actividades?.area === 'pintura') return 'pintura'
  return 'hojalateria'
}

const ICONO = { hojalateria: Hammer, pintura: PaintBucket, refaccion: Wrench }

/**
 * Materiales de hojalatería, materiales de pintura y refacciones usados en una unidad:
 * entregas del almacén, compras directas a la orden (recibidas o en proceso) y gastos capturados.
 * Si el presupuesto autorizado las incluye, se compara presupuestado contra real.
 */
export default function MaterialesUnidad({ ordenId, conPresupuesto = true, actualizar }: { ordenId: number; conPresupuesto?: boolean; actualizar?: unknown }) {
  const [lineas, setLineas] = useState<Linea[] | null>(null)
  const [pres, setPres] = useState<Record<Seccion, number>>({ hojalateria: 0, pintura: 0, refaccion: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('solicitudes_material').select('id,seccion,estado,cantidad_solicitada,cantidad_aprobada,cantidad_entregada,costo_total,costo_estimado,entregado_at,solicitado_at,materiales(descripcion,unidad,tipo,costo_promedio),actividades(area)').eq('orden_id', ordenId).in('estado', ['solicitada', 'autorizada', 'entregada']).order('id'),
      supabase.from('compra_partidas').select('id,seccion,cantidad,costo_unit,compra_id,materiales(descripcion,unidad,tipo),compras(estado,fecha)').eq('orden_id', ordenId).order('id'),
      supabase.from('orden_costos').select('id,tipo,concepto,proveedor,monto,fecha').eq('orden_id', ordenId).in('tipo', ['material', 'refaccion']).order('fecha'),
      supabase.from('presupuestos').select('presupuesto_partidas(area,concepto,cantidad,precio_unit)').eq('orden_id', ordenId).eq('estado', 'autorizado'),
    ]).then(([s, c, o, p]) => {
      type Sol = { id: number; seccion: string | null; estado: string; cantidad_solicitada: number; cantidad_aprobada: number | null; cantidad_entregada: number | null; costo_total: number | null; costo_estimado: number | null; entregado_at: string | null; solicitado_at: string; materiales: { descripcion: string; unidad: string; tipo: string; costo_promedio: number } | null; actividades: { area: string } | null }
      type Par = { id: number; seccion: string | null; cantidad: number; costo_unit: number; compra_id: number; materiales: { descripcion: string; unidad: string; tipo: string } | null; compras: { estado: string; fecha: string } | null }
      const ls: Linea[] = []
      for (const x of (s.data ?? []) as unknown as Sol[]) {
        const entregada = x.estado === 'entregada'
        const cant = entregada ? Number(x.cantidad_entregada ?? 0) : Number(x.cantidad_aprobada ?? x.cantidad_solicitada)
        ls.push({
          seccion: seccionDeSolicitud(x), descripcion: x.materiales?.descripcion ?? '', cantidad: `${num(cant, 3)} ${x.materiales?.unidad ?? ''}`,
          importe: entregada ? Number(x.costo_total ?? 0) : x.costo_estimado != null ? Number(x.costo_estimado) * cant / Number(x.cantidad_solicitada) : cant * Number(x.materiales?.costo_promedio ?? 0),
          origen: entregada ? 'Entregado' : x.estado === 'autorizada' ? 'Autorizado, por entregar' : 'Solicitado', estado: entregada ? 'real' : 'pendiente', fecha: x.entregado_at ?? x.solicitado_at,
        })
      }
      // Compras aún no recibidas (las recibidas ya aparecen como entrega a la orden)
      for (const x of (c.data ?? []) as unknown as Par[]) {
        if (!x.compras || ['recibida', 'cancelada'].includes(x.compras.estado)) continue
        ls.push({
          seccion: (x.seccion as Seccion) ?? seccionPorTipo(x.materiales?.tipo) as Seccion, descripcion: x.materiales?.descripcion ?? '', cantidad: `${num(x.cantidad, 3)} ${x.materiales?.unidad ?? ''}`,
          importe: Number(x.cantidad) * Number(x.costo_unit), origen: `En compra REQ-${String(x.compra_id).padStart(4, '0')}`, estado: 'pendiente', fecha: x.compras.fecha, link: `/compras/${x.compra_id}`,
        })
      }
      for (const x of (o.data ?? []) as { tipo: string; concepto: string; proveedor: string | null; monto: number; fecha: string }[])
        ls.push({ seccion: x.tipo === 'refaccion' ? 'refaccion' : 'hojalateria', descripcion: `${x.concepto}${x.proveedor ? ` · ${x.proveedor}` : ''}`, cantidad: '—', importe: Number(x.monto), origen: 'Gasto directo', estado: 'real', fecha: x.fecha })
      setLineas(ls)
      const pr: Record<Seccion, number> = { hojalateria: 0, pintura: 0, refaccion: 0 }
      for (const pp of ((p.data ?? []) as { presupuesto_partidas: { area: string; concepto: string; cantidad: number; precio_unit: number }[] }[]).flatMap(x => x.presupuesto_partidas)) {
        const imp = Number(pp.cantidad) * Number(pp.precio_unit)
        if (pp.concepto === 'refaccion') pr.refaccion += imp
        else if (pp.concepto === 'pintura' || (pp.concepto === 'material' && pp.area === 'pintura')) pr.pintura += imp
        else if (pp.concepto === 'material') pr.hojalateria += imp
      }
      setPres(pr)
    })
  }, [ordenId, actualizar])

  if (!lineas) return <div className="esqueleto h-40" />
  const secciones: Seccion[] = ['hojalateria', 'pintura', 'refaccion']
  const totReal = lineas.filter(l => l.estado === 'real').reduce((t, l) => t + l.importe, 0)
  const totPend = lineas.filter(l => l.estado === 'pendiente').reduce((t, l) => t + l.importe, 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {secciones.map(k => {
          const real = lineas.filter(l => l.seccion === k && l.estado === 'real').reduce((t, l) => t + l.importe, 0)
          const Icono = ICONO[k]
          return (
            <div key={k} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icono className="h-4 w-4 text-brand-600" /> {SECCIONES_MAT[k]}</div>
              <div className="mt-1 text-xl font-extrabold text-slate-900">{money2(real)}</div>
              {conPresupuesto && pres[k] > 0 && <div className="text-xs text-slate-500">Presupuestado {money2(pres[k])} · <span className={real > pres[k] ? 'font-semibold text-red-600' : 'text-green-700'}>{real > pres[k] ? 'excede' : 'dentro'} {money2(Math.abs(pres[k] - real))}</span></div>}
            </div>
          )
        })}
      </div>
      {secciones.map(k => {
        const ls = lineas.filter(l => l.seccion === k)
        return (
          <div key={k}>
            <div className="mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase">{SECCIONES_MAT[k]}</div>
            {ls.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400">Sin registros</p> : (
              <div className="overflow-x-auto"><table className="tbl">
                <thead><tr><th>Descripción</th><th className="text-right">Cantidad</th><th>Origen</th><th>Fecha</th><th className="text-right">Importe</th></tr></thead>
                <tbody>{ls.map((l, i) => (
                  <tr key={i} className={l.estado === 'pendiente' ? 'text-slate-500' : ''}>
                    <td className="font-medium">{l.descripcion}</td><td className="text-right">{l.cantidad}</td>
                    <td className="text-xs">{l.link ? <Link className="font-semibold text-brand-700 hover:underline" to={l.link}>{l.origen}</Link> : l.origen}</td>
                    <td className="text-xs">{l.fecha ? fecha(l.fecha.slice(0, 10)) : '—'}</td>
                    <td className="text-right font-semibold">{money2(l.importe)}{l.estado === 'pendiente' && <div className="text-[10px] font-normal">por confirmar</div>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </div>
        )
      })}
      <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t pt-2 text-sm">
        <span>Gastado (entregado y comprado): <b>{money2(totReal)}</b> <span className="text-slate-400">(sin IVA)</span></span>
        {totPend > 0 && <span className="text-slate-500">Por confirmar (solicitado o en compra): <b>{money2(totPend)}</b></span>}
      </div>
    </div>
  )
}
