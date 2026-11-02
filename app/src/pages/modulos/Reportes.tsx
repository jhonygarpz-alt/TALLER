import { FileSpreadsheet, Printer, Target } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { PageHeader, SinPermiso, Tabs, useTab } from '../../components/ui'
import { TabKpis, TabReportes } from '../resultados/analisis'

export default function Reportes() {
  const { puede } = useAuth()
  const tab = useTab('reportes')
  if (!puede('reportes.ver') && !puede('finanzas.ver')) return <SinPermiso que="Reportes" />
  return (
    <div>
      <PageHeader title="Reportes y KPIs" subtitle="Descargas a Excel, impresión a PDF e indicadores de aseguradora">
        <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</button>
      </PageHeader>
      <Tabs tabs={[
        { id: 'reportes', label: 'Reportes', icon: FileSpreadsheet },
        { id: 'kpis', label: 'KPIs de aseguradora', icon: Target },
      ]} />
      {tab === 'reportes' ? <TabReportes /> : <TabKpis />}
    </div>
  )
}
