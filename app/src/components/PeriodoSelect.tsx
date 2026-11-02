import { CalendarDays } from 'lucide-react'
import { PERIODOS, type PeriodoId } from '../lib/periodo'

export default function PeriodoSelect({ periodo, setPeriodo, texto }: { periodo: PeriodoId; setPeriodo: (p: PeriodoId) => void; texto: string }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <CalendarDays className="h-4 w-4 text-slate-500" />
      <select className="bg-transparent font-medium text-slate-700 focus:outline-none" value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoId)}>
        {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <span className="hidden text-xs text-slate-400 lg:inline">{texto}</span>
    </label>
  )
}
