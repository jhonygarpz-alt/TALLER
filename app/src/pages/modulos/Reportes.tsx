import { lazy, Suspense } from 'react'
import { FileSpreadsheet, FileText, Printer, Target } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { PageHeader, SinPermiso, Tabs, useTab } from '../../components/ui'
import { TabKpis, TabReportes } from '../resultados/analisis'

const ReporteMensual = lazy(() => import('../resultados/ReporteMensual'))

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
        { id: 'mensual', label: 'Reporte mensual', icon: FileText, hidden: !puede('finanzas.ver') },
      ]} />
      {tab === 'mensual' && puede('finanzas.ver') ? <Suspense fallback={<div className="esqueleto h-96" />}><ReporteMensual /></Suspense>
        : tab === 'kpis' ? <TabKpis /> : <TabReportes />}
    </div>
  )
}
