import { ArrowLeftRight, ClipboardList, Package, Paintbrush } from 'lucide-react'
import { useAlertas } from '../../lib/alertas'
import { PageHeader, Tabs, useTab } from '../../components/ui'
import { TabMateriales, TabMovimientos, TabPintura, TabSolicitudes } from '../compras/inventario'

export default function Inventario() {
  const al = useAlertas()
  const tab = useTab('existencias')
  return (
    <div>
      <PageHeader title="Inventario" subtitle="Existencias, salidas a órdenes, control de pintura y movimientos" />
      <Tabs tabs={[
        { id: 'existencias', label: 'Existencias', icon: Package },
        { id: 'solicitudes', label: 'Solicitudes y salidas', icon: ClipboardList, count: al.solicitudesPorAutorizar + al.solicitudesPorEntregar },
        { id: 'pintura', label: 'Control de pintura', icon: Paintbrush },
        { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight },
      ]} />
      {tab === 'existencias' && <TabMateriales />}
      {tab === 'solicitudes' && <TabSolicitudes />}
      {tab === 'pintura' && <TabPintura />}
      {tab === 'movimientos' && <TabMovimientos />}
    </div>
  )
}
