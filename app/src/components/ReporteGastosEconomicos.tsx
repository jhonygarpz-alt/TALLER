import { useEffect, useState } from 'react'
import { Check, FileSpreadsheet, FileText, Loader2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errorTexto } from '../lib/format'
import { ErrorMsg, Modal } from './ui'

interface Unidad { id: number; folio: string; marca: string; modelo: string; anio: number | null; placas: string | null; siniestro: string | null; color: string | null; etapa: string }

/**
 * Pregunta de qué unidad es el reporte y lo descarga en Excel o PDF con el formato fijo.
 * Si se abre desde un expediente, la unidad viene preseleccionada pero se puede cambiar.
 */
export default function ReporteGastosEconomicos({ ordenId, onClose }: { ordenId?: number; onClose: () => void }) {
  const { perfil } = useAuth()
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<Unidad[]>([])
  const [sel, setSel] = useState<Unidad | null>(null)
  const [cargando, setCargando] = useState<'' | 'xlsx' | 'pdf'>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ordenId) supabase.from('v_ordenes').select('id,folio,marca,modelo,anio,placas,siniestro,color,etapa').eq('id', ordenId).single().then(({ data }) => data && setSel(data as Unidad))
  }, [ordenId])

  useEffect(() => {
    const t = setTimeout(() => {
      let consulta = supabase.from('v_ordenes').select('id,folio,marca,modelo,anio,placas,siniestro,color,etapa').neq('etapa', 'cancelado').order('fecha_ingreso', { ascending: false }).limit(30)
      const s = q.trim().replace(/[,()%]/g, ' ').trim()
      if (s) {
        const sinGuion = `%${s.replace(/[\s-]+/g, '').split('').join('%')}%`
        consulta = consulta.or(`folio.ilike.%${s}%,placas.ilike.${sinGuion},siniestro.ilike.%${s}%,marca.ilike.%${s}%,modelo.ilike.%${s}%,cliente_nombre.ilike.%${s}%`)
      }
      consulta.then(({ data }) => setLista((data ?? []) as Unidad[]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  async function generar(tipo: 'xlsx' | 'pdf') {
    if (!sel) return setError('Elige la unidad del reporte')
    setError(null); setCargando(tipo)
    try {
      const m = await import('../lib/reporteGastos')
      const d = await m.cargarReporte(sel.id, perfil?.nombre ?? '')
      await (tipo === 'xlsx' ? m.exportarExcel(d) : m.exportarPdf(d))
    } catch (e) {
      setError(errorTexto(e as { message: string }))
    } finally { setCargando('') }
  }

  return (
    <Modal title="Reporte de gastos económicos" onClose={onClose}>
      <ErrorMsg error={error} />
      <p className="mb-3 text-sm text-slate-600">¿De qué unidad es el reporte? Busca por orden de servicio, placas, siniestro, marca o cliente.</p>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Ej. 1792, RAT861C, 4264…" />
      </div>
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {lista.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Sin unidades que coincidan</p>}
        {lista.map(u => {
          const activo = sel?.id === u.id
          return (
            <button key={u.id} type="button" onClick={() => setSel(u)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${activo ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${activo ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{activo ? <Check className="h-4 w-4" /> : <span className="text-[10px] font-bold">OS</span>}</span>
              <span className="min-w-0 flex-1"><b>{u.folio}</b> · {u.marca} {u.modelo} {u.anio ?? ''}<span className="block truncate text-xs text-slate-500">{u.placas ?? 'Sin placas'}{u.color ? ` · ${u.color}` : ''}{u.siniestro ? ` · Siniestro ${u.siniestro}` : ''}</span></span>
            </button>
          )
        })}
      </div>
      {sel && <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">Unidad seleccionada: <b>{sel.folio}</b> · {sel.marca} {sel.modelo} {sel.placas ?? ''}</div>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        <button className="btn btn-secondary" disabled={!sel || !!cargando} onClick={() => generar('xlsx')}>{cargando === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Descargar Excel</button>
        <button className="btn btn-primary" disabled={!sel || !!cargando} onClick={() => generar('pdf')}>{cargando === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Descargar PDF</button>
      </div>
    </Modal>
  )
}
