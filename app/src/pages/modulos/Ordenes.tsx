import { Link } from 'react-router-dom'
import { ClipboardList, Inbox, Plus } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useAlertas } from '../../lib/alertas'
import { PageHeader, Tabs, useTab } from '../../components/ui'
import { ListaOrdenes } from '../vehiculos/ordenes'
import Asignaciones from '../vehiculos/Asignaciones'

export default function Ordenes() {
  const { puede } = useAuth()
  const al = useAlertas()
  const tab = useTab('ordenes')
  return (
    <div>
      <PageHeader title="Órdenes de trabajo" subtitle="Asignaciones, recepción, expediente y cierre de cada vehículo">
        {puede('ordenes.gestionar') && <Link to="/ordenes/nueva" className="btn btn-primary"><Plus className="h-4 w-4" /> Nueva orden</Link>}
      </PageHeader>
      <Tabs tabs={[
        { id: 'ordenes', label: 'Órdenes', icon: ClipboardList },
        { id: 'asignaciones', label: 'Asignaciones de aseguradora', icon: Inbox, count: al.sinContactar },
      ]} />
      {tab === 'ordenes' ? <ListaOrdenes /> : <Asignaciones />}
    </div>
  )
}
