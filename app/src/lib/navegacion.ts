import { BarChart3, CalendarDays, ClipboardList, Coins, FileText, HardHat, LayoutDashboard, Package, Settings, ShoppingCart, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Los 12 módulos del menú. "permiso" oculta el módulo a quien no puede consultarlo (la base de datos también lo impide). */
export const NAV: { to: string; label: string; icon: LucideIcon; permiso?: string[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes y aseguradoras', icon: Users },
  { to: '/ordenes', label: 'Órdenes de trabajo', icon: ClipboardList },
  { to: '/procesos', label: 'Procesos del taller', icon: Wrench },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
  { to: '/mano-obra', label: 'Mano de obra y destajos', icon: HardHat },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/costos', label: 'Costos y rentabilidad', icon: Coins, permiso: ['finanzas.ver'] },
  { to: '/facturacion', label: 'Facturación y cobranza', icon: FileText, permiso: ['finanzas.ver'] },
  { to: '/reportes', label: 'Reportes y KPIs', icon: BarChart3, permiso: ['reportes.ver', 'finanzas.ver'] },
  { to: '/administracion', label: 'Administración', icon: Settings, permiso: ['usuarios.gestionar', 'config.gestionar', 'auditoria.ver'] },
]

/** Ícono del módulo al que pertenece una ruta */
export function iconoDeRuta(pathname: string): LucideIcon | undefined {
  const m = NAV.filter(n => n.to !== '/' && pathname.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0]
  return (m ?? (pathname === '/' ? NAV[0] : undefined))?.icon
}
