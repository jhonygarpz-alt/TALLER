import { Banknote, HandCoins, Receipt, TrendingUp } from 'lucide-react'
import { Kpi, type PropsPantalla } from '../AppGerencia'
import { Apilada, C, Dona, Medidor, Panel } from '../graficas'
import { moneda, monedaCorta } from '../datos'

export default function Finanzas({ datos: d }: PropsPantalla) {
  const f = d.finanzas
  if (!f) return null
  const margen = f.ingreso ? f.utilidad / f.ingreso * 100 : null
  const costos = [
    { label: 'Materiales, pintura y refacciones', valor: Math.round(f.materiales), color: C.cian },
    { label: 'Mano de obra y destajos', valor: Math.round(f.mano_obra), color: C.violeta },
    { label: 'Servicios externos y otros', valor: Math.round(f.externos), color: C.ambar },
  ]
  return (
    <>
      <Panel titulo="Rentabilidad del periodo" sub={`${f.ordenes} órdenes entregadas en el periodo · montos autorizados`}>
        <div className="flex items-center gap-3">
          <div className="w-[46%] shrink-0"><Medidor valor={margen} etiqueta="Margen estimado" /></div>
          <dl className="min-w-0 flex-1 space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Ingreso</dt><dd className="font-bold text-white">{moneda(f.ingreso)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Costos directos</dt><dd className="font-bold text-rose-300">−{moneda(f.costos)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-400">Indirectos</dt><dd className="font-bold text-rose-300">−{moneda(f.utilidad_bruta - f.utilidad)}</dd></div>
            <div className="flex justify-between gap-2 border-t border-white/10 pt-2"><dt className="text-slate-300">Utilidad</dt><dd className="font-extrabold" style={{ color: f.utilidad >= 0 ? C.verde : C.rojo }}>{moneda(f.utilidad)}</dd></div>
          </dl>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Kpi icono={TrendingUp} color={C.verde} label="Utilidad bruta" valor={monedaCorta(f.utilidad_bruta)} sub="Ingreso − costos directos" />
        <Kpi icono={HandCoins} color={C.ambar} label="Destajos por pagar" valor={monedaCorta(f.destajos_pendientes)} sub="Pendientes y autorizados" />
      </div>

      <Panel titulo="¿En qué se va el costo?" sub="Costos directos de las órdenes entregadas">
        <Dona centro={monedaCorta(f.costos)} sub="costos" datos={costos} tam={124} />
        <div className="mt-4"><Apilada datos={costos} /></div>
        {f.costos === 0 && <p className="mt-3 text-xs text-slate-500">Las órdenes entregadas en el periodo aún no tienen costos registrados (materiales, destajos o servicios).</p>}
      </Panel>

      <Panel titulo="Facturación y cobranza">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icono={Receipt} color={C.azul} label="Facturado en el periodo" valor={monedaCorta(f.facturado)} />
          <Kpi icono={Banknote} color={C.verde} label="Cobrado en el periodo" valor={monedaCorta(f.cobrado)} />
          <Kpi icono={Receipt} color={C.violeta} label="Por cobrar (total)" valor={monedaCorta(f.por_cobrar)} />
          <Kpi icono={Receipt} color={C.rojo} label="Vencido" valor={monedaCorta(f.vencido)} />
        </div>
        {f.facturado === 0 && f.cobrado === 0 && f.por_cobrar === 0 && <p className="mt-3 text-xs text-slate-500">Aún no hay facturas ni cobros registrados en el sistema (módulo Facturación y cobranza).</p>}
      </Panel>
    </>
  )
}
