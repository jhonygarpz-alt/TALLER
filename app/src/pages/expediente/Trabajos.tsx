import { useAuth } from '../../lib/auth'
import { Card } from '../../components/ui'
import Actividades from '../../components/Actividades'
import type { TabProps } from './Expediente'

export default function Trabajos({ o, recargar }: TabProps) {
  const { puede } = useAuth()
  const cerrada = o.etapa === 'entregado' || o.etapa === 'cancelado'
  return (
    <Card title="Trabajos asignados y avance">
      {!cerrada && !puede('actividades.asignar') && <p className="mb-3 text-sm text-slate-500">Solo el supervisor asigna trabajos. Los técnicos pueden iniciar y terminar los suyos adjuntando evidencia.</p>}
      <Actividades ordenId={o.id} cerrada={cerrada} onCambio={recargar} />
      <p className="mt-4 text-xs text-slate-500">Flujo de destajo: el técnico termina con foto de evidencia → el supervisor valida → se genera el destajo con la tarifa configurada → administración autoriza → se registra el pago. Un trabajo solo genera un destajo.</p>
    </Card>
  )
}
