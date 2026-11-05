import { Banknote, HandCoins, Receipt, ReceiptText, Star, Timer, TrendingUp, WalletCards } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Apilada, Barras, C, Dona, Medidor, Panel } from '../graficas'
import { moneda, monedaCorta } from '../datos'

export default function Reportes({ datos: d }: PropsPantalla) {
  const { puede } = useAuth()
  const p = d.periodo, f = puede('finanzas.ver') ? d.finanzas : null
  const cumplimiento = p.con_compromiso ? p.a_tiempo / p.con_compromiso * 100 : null
  const margen = f?.ingreso ? f.utilidad / f.ingreso * 100 : null
  const costos = f ? [
    { label: 'Materiales y refacciones', valor: Math.round(f.materiales), color: C.oscuro },
    { label: 'Mano de obra y destajos', valor: Math.round(f.mano_obra), color: C.lima },
    { label: 'Servicios externos y otros', valor: Math.round(f.externos), color: C.ambar },
  ] : []
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Panel className="!p-3">
          <Medidor valor={cumplimiento} etiqueta="Entregas a tiempo" />
          <div className="mt-1 text-center text-[11px] text-[#66736c]">{p.a_tiempo} de {p.con_compromiso} con fecha compromiso</div>
        </Panel>
        <Panel className="!p-3">
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Timer className="h-5 w-5 text-[#1f7a45]" strokeWidth={1.8} />
            <div className="mt-1 text-[28px] leading-none font-bold">{p.dias_promedio ?? '—'}</div>
            <div className="text-[11.5px] text-[#66736c]">días promedio en taller</div>
            <div className="mt-2 flex gap-0.5">{[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4" style={{ color: C.ambar, fill: p.satisfaccion != null && i <= Math.round(p.satisfaccion) ? C.ambar : 'transparent' }} />)}</div>
            <div className="text-[11.5px] text-[#66736c]">{p.satisfaccion != null ? `${p.satisfaccion} · ${p.encuestas} encuesta${p.encuestas === 1 ? '' : 's'}` : 'Sin encuestas'}</div>
          </div>
        </Panel>
      </div>

      <Panel titulo="Origen de los ingresos" sub="Vehículos que ingresaron en el periodo">
        <Dona centro={p.ingresos} sub="Unidades" datos={[
          { label: 'Aseguradora', valor: p.ingresos_aseguradora, color: C.oscuro },
          { label: 'Particular', valor: p.ingresos_particular, color: C.lima },
        ]} />
      </Panel>

      <Panel titulo="Marcas más atendidas" sub="Ingresos del periodo">
        <Barras datos={d.marcas.map((m, i) => ({ label: m.marca, valor: m.n, color: [C.oscuro, C.medio, C.lima, C.ambar, C.teal, C.gris][i % 6] }))} vacio="Sin ingresos en el periodo" />
      </Panel>

      {f && (
        <>
          <Panel titulo="Rentabilidad del periodo" sub={`${f.ordenes} órdenes entregadas · montos autorizados`}>
            <div className="flex items-center gap-3">
              <div className="w-[44%] shrink-0"><Medidor valor={margen} etiqueta="Margen estimado" /></div>
              <dl className="min-w-0 flex-1 space-y-2 text-[13.5px]">
                <div className="flex justify-between gap-2"><dt className="text-[#66736c]">Ingreso</dt><dd className="font-semibold">{moneda(f.ingreso)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-[#66736c]">Costos directos</dt><dd className="font-semibold text-[#c2453d]">−{moneda(f.costos)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-[#66736c]">Indirectos</dt><dd className="font-semibold text-[#c2453d]">−{moneda(f.utilidad_bruta - f.utilidad)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-black/[.06] pt-2"><dt>Utilidad</dt><dd className="font-bold" style={{ color: f.utilidad >= 0 ? C.verde : C.rojo }}>{moneda(f.utilidad)}</dd></div>
              </dl>
            </div>
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            <Kpi icono={TrendingUp} label="Utilidad bruta" valor={monedaCorta(f.utilidad_bruta)} />
            <Kpi icono={HandCoins} label="Destajos por pagar" valor={monedaCorta(f.destajos_pendientes)} />
          </div>
          <Panel titulo="¿En qué se va el costo?" sub="Costos directos de las órdenes entregadas">
            <Dona centro={monedaCorta(f.costos)} sub="Costos" datos={costos} tam={124} />
            <div className="mt-4"><Apilada datos={costos} /></div>
            {f.costos === 0 && <p className="mt-3 text-xs text-[#66736c]">Las órdenes entregadas en el periodo aún no tienen costos registrados (materiales, destajos o servicios).</p>}
          </Panel>
          <Panel titulo="Facturación y cobranza">
            <div className="grid grid-cols-2 gap-3">
              <Kpi icono={Receipt} label="Facturado" valor={monedaCorta(f.facturado)} />
              <Kpi icono={Banknote} label="Cobrado" valor={monedaCorta(f.cobrado)} />
              <Kpi icono={WalletCards} label="Por cobrar" valor={monedaCorta(f.por_cobrar)} />
              <Kpi icono={ReceiptText} label="Vencido" valor={monedaCorta(f.vencido)} />
            </div>
            {f.facturado === 0 && f.cobrado === 0 && f.por_cobrar === 0 && <p className="mt-3 text-xs text-[#66736c]">Aún no hay facturas ni cobros registrados en el sistema (módulo Facturación y cobranza).</p>}
          </Panel>
        </>
      )}
    </>
  )
}
