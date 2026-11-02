-- Elimina el esquema genérico v1 (proyecto vacío, sin datos) antes de crear TallerPro.
drop view if exists public.v_resultados_mensuales, public.v_compras, public.v_ordenes;
drop table if exists public.pagos, public.orden_refacciones, public.orden_servicios, public.ordenes,
  public.movimientos_inventario, public.compra_detalle, public.compras, public.proveedores,
  public.productos, public.vehiculos, public.clientes cascade;
drop function if exists public.fn_compra_detalle_stock(), public.fn_orden_refaccion_stock(),
  public.fn_orden_refaccion_costo(), public.fn_orden_entrega();
drop type if exists public.estado_orden;
