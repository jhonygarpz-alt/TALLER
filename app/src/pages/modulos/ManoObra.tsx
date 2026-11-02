import { BadgeDollarSign, Gauge, ListChecks, Users } from 'lucide-react'
import { PageHeader, Tabs, useTab } from '../../components/ui'
import { Destajos, ListaActividades, Productividad, TecnicosTarifas } from '../taller/produccion'

export default function ManoObra() {
  const tab = useTab('trabajos')
  return (
    <div>
      <PageHeader title="Mano de obra y destajos" subtitle="Trabajos por técnico, validación, destajos y productividad" />
      <Tabs tabs={[
        { id: 'trabajos', label: 'Trabajos', icon: ListChecks },
        { id: 'destajos', label: 'Destajos', icon: BadgeDollarSign },
        { id: 'productividad', label: 'Productividad', icon: Gauge },
        { id: 'tecnicos', label: 'Técnicos y tarifas', icon: Users },
      ]} />
      {tab === 'trabajos' && <ListaActividades />}
      {tab === 'destajos' && <Destajos />}
      {tab === 'productividad' && <Productividad />}
      {tab === 'tecnicos' && <TecnicosTarifas />}
    </div>
  )
}
