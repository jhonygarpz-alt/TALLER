import { BarChart3, CalendarDays, ClipboardList, Coins, FileText, HardHat, LayoutDashboard, Package, Settings, ShoppingCart, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Los 12 módulos del sistema. "permiso" oculta el módulo a quien no puede consultarlo (la base de datos también lo impide). */
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

/** Accesos directos dentro de un módulo: apuntan a pestañas o filtros que ya existen en esa pantalla */
export interface SubNav { label: string; to: string; permiso?: string[]; contador?: 'retrasadas' | 'sinContactar' | 'listas' | 'comprasPorAutorizar' | 'solicitudesPorAutorizar' | 'detenidas' }
export interface ItemNav { to: string; label: string; icon: LucideIcon; permiso?: string[]; hijos?: SubNav[]; contador?: SubNav['contador'] }
export interface GrupoNav { titulo: string; items: ItemNav[] }

const m = (to: string) => NAV.find(n => n.to === to)!

/**
 * Menú agrupado por área. Reúne exactamente los mismos 12 módulos (ninguno se duplica ni se elimina);
 * los submenús solo abren pestañas o filtros existentes de cada módulo.
 */
export const GRUPOS_NAV: GrupoNav[] = [
  { titulo: 'Dashboard', items: [
    { ...m('/'), label: 'Panel de control' },
  ] },
  { titulo: 'Operación', items: [
    { ...m('/ordenes'), contador: 'retrasadas', hijos: [
      { label: 'Todas las órdenes', to: '/ordenes?tab=ordenes' },
      { label: 'Recepción de vehículo', to: '/ordenes/nueva', permiso: ['ordenes.gestionar'] },
      { label: 'Asignaciones de aseguradora', to: '/ordenes?tab=asignaciones', contador: 'sinContactar' },
      { label: 'En diagnóstico y autorización', to: '/ordenes?filtro=etapa:recepcion,diagnostico,esperando_autorizacion' },
      { label: 'Control de calidad', to: '/ordenes?filtro=etapa:control_calidad' },
      { label: 'Listos para entrega', to: '/ordenes?filtro=etapa:listo_entrega', contador: 'listas' },
      { label: 'Con retraso', to: '/ordenes?filtro=retrasados', contador: 'retrasadas' },
    ] },
    { ...m('/procesos'), hijos: [
      { label: 'Tablero de producción', to: '/procesos?tab=tablero' },
      { label: 'Asignación y trabajos en curso', to: '/procesos?tab=trabajos' },
      { label: 'Vista de lista', to: '/procesos?tab=lista' },
      { label: 'Gantt de producción', to: '/procesos?tab=gantt' },
      { label: 'Calendario de producción', to: '/procesos?tab=calendario' },
    ] },
    { ...m('/calendario') },
  ] },
  { titulo: 'Administración', items: [
    { ...m('/clientes'), hijos: [
      { label: 'Clientes', to: '/clientes?tab=clientes' },
      { label: 'Aseguradoras', to: '/clientes?tab=aseguradoras' },
      { label: 'Vehículos', to: '/clientes?tab=vehiculos' },
      { label: 'Llamadas y citas', to: '/clientes?tab=seguimiento' },
      { label: 'Encuestas', to: '/clientes?tab=encuestas' },
    ] },
    { ...m('/compras'), contador: 'comprasPorAutorizar', hijos: [
      { label: 'Solicitudes y órdenes de compra', to: '/compras?tab=compras', contador: 'comprasPorAutorizar' },
      { label: 'Proveedores', to: '/compras?tab=proveedores' },
      { label: 'Historial de precios', to: '/compras?tab=precios' },
    ] },
    { ...m('/inventario'), contador: 'solicitudesPorAutorizar', hijos: [
      { label: 'Existencias', to: '/inventario?tab=existencias' },
      { label: 'Solicitudes y salidas', to: '/inventario?tab=solicitudes', contador: 'solicitudesPorAutorizar' },
      { label: 'Control de pintura', to: '/inventario?tab=pintura' },
      { label: 'Movimientos', to: '/inventario?tab=movimientos' },
    ] },
  ] },
  { titulo: 'Control financiero', items: [
    { ...m('/costos'), hijos: [
      { label: 'Rentabilidad por orden', to: '/costos?tab=rentabilidad' },
      { label: 'Presupuesto vs real', to: '/costos?tab=comparativo' },
      { label: 'Costos de pintura', to: '/costos?tab=pintura' },
      { label: 'Costos de materiales', to: '/costos?tab=material' },
      { label: 'Refacciones', to: '/costos?tab=refaccion' },
      { label: 'Servicios externos', to: '/costos?tab=externo' },
      { label: 'Indicadores financieros', to: '/costos?tab=financiero' },
    ] },
    { ...m('/mano-obra'), hijos: [
      { label: 'Trabajos', to: '/mano-obra?tab=trabajos' },
      { label: 'Destajos', to: '/mano-obra?tab=destajos' },
      { label: 'Productividad', to: '/mano-obra?tab=productividad' },
      { label: 'Técnicos y tarifas', to: '/mano-obra?tab=tecnicos' },
    ] },
    { ...m('/facturacion'), hijos: [
      { label: 'Por facturar', to: '/facturacion?tab=pendientes' },
      { label: 'Facturas', to: '/facturacion?tab=facturas' },
      { label: 'Cuentas por cobrar', to: '/facturacion?tab=cxc' },
      { label: 'Pagos recibidos', to: '/facturacion?tab=pagos' },
      { label: 'Estados de cuenta', to: '/facturacion?tab=estados' },
    ] },
  ] },
  { titulo: 'Gerencia', items: [
    { ...m('/reportes'), hijos: [
      { label: 'Reportes', to: '/reportes?tab=reportes' },
      { label: 'KPIs de aseguradora', to: '/reportes?tab=kpis' },
      { label: 'Reporte mensual', to: '/reportes?tab=mensual' },
    ] },
  ] },
  { titulo: 'Sistema', items: [
    { ...m('/administracion'), label: 'Administración', hijos: [
      { label: 'Usuarios', to: '/administracion?tab=usuarios', permiso: ['usuarios.gestionar'] },
      { label: 'Permisos por rol', to: '/administracion?tab=permisos', permiso: ['usuarios.gestionar'] },
      { label: 'Empresa y logo', to: '/administracion?tab=empresa', permiso: ['config.gestionar'] },
      { label: 'Catálogos', to: '/administracion?tab=catalogos', permiso: ['config.gestionar'] },
      { label: 'Parámetros e indicadores', to: '/administracion?tab=parametros', permiso: ['config.gestionar'] },
      { label: 'Bitácora de movimientos', to: '/administracion?tab=auditoria', permiso: ['auditoria.ver'] },
    ] },
  ] },
]

/** Ícono del módulo al que pertenece una ruta */
export function iconoDeRuta(pathname: string): LucideIcon | undefined {
  const mod = NAV.filter(n => n.to !== '/' && pathname.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0]
  return (mod ?? (pathname === '/' ? NAV[0] : undefined))?.icon
}
