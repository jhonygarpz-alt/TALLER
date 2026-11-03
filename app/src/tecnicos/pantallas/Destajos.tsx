import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fecha, money2 } from '../../lib/format'
import { Barra, Cargando, Vacio } from '../../movil/ui'
import { useMisFichas } from '../datos'

interface Fila { id: number; importe: number; estado: string; generado_at: string; pagado_at: string | null; referencia_pago: string | null; actividades: { actividad: string } | null; ordenes: { folio: string; vehiculos: { marca: string; modelo: string; placas: string | null } | null } | null }
const ESTADO: Record<string, [string, string]> = { pendiente: ['Por autorizar', 'bg-amber-100 text-amber-800'], autorizado: ['Autorizado', 'bg-sky-100 text-sky-800'], pagado: ['Pagado', 'bg-emerald-100 text-emerald-800'] }
const PERIODOS: [string, string, number][] = [['semana', 'Esta semana', 7], ['quincena', '15 días', 15], ['mes', 'Este mes', 31], ['todo', 'Todo', 0]]

/** Destajos del propio técnico (solo los suyos; lo garantiza la base de datos) */
export default function MisDestajos() {
  const fichas = useMisFichas()
  const [periodo, setPeriodo] = useState('quincena')
  const [rows, setRows] = useState<Fila[] | null>(null)
  useEffect(() => {
    if (!fichas) return
    if (!fichas.length) { setRows([]); return }
    setRows(null)
    const dias = PERIODOS.find(p => p[0] === periodo)![2]
    let q = supabase.from('destajos').select('id,importe,estado,generado_at,pagado_at,referencia_pago,actividades(actividad),ordenes(folio,vehiculos(marca,modelo,placas))').in('tecnico_id', fichas.map(f => f.id)).neq('estado', 'cancelado').order('generado_at', { ascending: false }).limit(300)
    if (dias) q = q.gte('generado_at', new Date(Date.now() - dias * 864e5).toISOString())
    q.then(({ data }) => setRows((data ?? []) as unknown as Fila[]))
  }, [fichas, periodo])

  const suma = (e?: string) => (rows ?? []).filter(r => !e || r.estado === e).reduce((s, r) => s + Number(r.importe), 0)
  return (
    <div>
      <Barra titulo="Mis destajos" sub="Pagos por trabajos validados" />
      <div className="space-y-4 p-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">{PERIODOS.map(([id, l]) => (
          <button key={id} onClick={() => setPeriodo(id)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${periodo === id ? 'bg-brand-700 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{l}</button>
        ))}</div>
        <div className="rounded-3xl bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white shadow-lg">
          <div className="text-sm text-emerald-100/80">Total generado</div>
          <div className="text-4xl font-black">{money2(suma())}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {(['pendiente', 'autorizado', 'pagado'] as const).map(e => <div key={e} className="rounded-2xl bg-white/10 p-2"><div className="text-emerald-100/75">{ESTADO[e][0]}</div><div className="text-sm font-bold">{money2(suma(e))}</div></div>)}
          </div>
        </div>
        {!rows ? <Cargando /> : rows.length === 0 ? <Vacio icono={Wallet}>{fichas?.length === 0 ? 'Tu usuario no está ligado a un técnico.' : 'Sin destajos en este periodo. Se generan cuando el supervisor valida tus trabajos.'}</Vacio> : (
          <div className="space-y-2.5">{rows.map(r => {
            const [l, c] = ESTADO[r.estado] ?? [r.estado, '']
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.actividades?.actividad}</div>
                  <div className="truncate text-xs text-slate-500">{r.ordenes?.folio} · {r.ordenes?.vehiculos?.marca} {r.ordenes?.vehiculos?.modelo} {r.ordenes?.vehiculos?.placas ?? ''}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]"><span className={`rounded-full px-2 py-0.5 font-semibold ${c}`}>{l}</span><span className="text-slate-400">{r.estado === 'pagado' && r.pagado_at ? `Pagado ${fecha(r.pagado_at)}` : `Generado ${fecha(r.generado_at)}`}</span></div>
                </div>
                <div className="text-right text-base font-extrabold text-slate-900">{money2(r.importe)}</div>
              </div>
            )
          })}</div>
        )}
      </div>
    </div>
  )
}
