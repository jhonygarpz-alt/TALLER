import { CalendarDays } from 'lucide-react'
import { PERIODOS, type PeriodoId } from '../lib/periodo'

export default function PeriodoSelect({ periodo, setPeriodo, texto }: { periodo: PeriodoId; setPeriodo: (p: PeriodoId) => void; texto: string }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-[#d7e7ec] bg-white px-3.5 py-2 text-sm shadow-sm">
      <CalendarDays className="h-4 w-4 text-[#17657c]" />
      <select className="bg-transparent font-semibold text-[#193344] focus:outline-none" value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoId)}>
        {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <span className="hidden text-xs text-[#66818f] lg:inline">{texto}</span>
    </label>
  )
}
